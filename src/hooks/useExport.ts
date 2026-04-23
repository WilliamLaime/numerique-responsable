import { useCallback } from 'react';
import { auditStore } from '../store/auditStore';
import { csvEscape } from '../lib/exportUtils';
import { themeKeyOf, sortEntries } from '../lib/aggregation';
import { RGAA_TO_WCAG } from '../lib/grading';
import type { AggregatedEntry } from '../types/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDFDoc = any;

declare global {
  interface Window {
    jspdf: { jsPDF: new (opts: Record<string, unknown>) => JsPDFDoc };
  }
}

export function useExport() {
  const exportCsv = useCallback(() => {
    const { pagesResults, aggregated, mode, activeStatuses, activeThemes, referential } = auditStore.getState();
    if (!aggregated || !pagesResults.length) return;

    const rows: string[][] = [[
      'page_url', 'type', 'thematique', 'statut',
      'regle_id', 'critere', 'wcag_criterion', 'niveau', 'titre',
      'severite_eco', 'occurrences', 'mesure', 'conseil', 'question_manuelle',
    ]];

    for (const kind of ['a11y', 'eco'] as const) {
      if (!aggregated.byRule[kind]) continue;
      if (mode !== kind && mode !== 'both') continue;
      for (const entry of aggregated.byRule[kind].values()) {
        const r = entry.rule;
        const theme = themeKeyOf(kind, r, referential);
        if (activeThemes.size && !activeThemes.has(theme)) continue;
        for (const p of entry.byPage) {
          if (!activeStatuses.has(p.status)) continue;
          rows.push([
            p.url,
            kind === 'a11y' ? 'Accessibilité' : 'Écoconception',
            theme,
            p.status,
            r.id,
            kind === 'a11y' ? (r.rgaa || '') : (r.critere || ''),
            kind === 'a11y' ? (RGAA_TO_WCAG[r.rgaa || '']?.criterion || '') : '',
            kind === 'a11y' ? (r.level || '') : '',
            r.title || '',
            kind === 'eco' ? (r.severity || '') : '',
            String(p.count || 0),
            p.measure || r.measure || '',
            r.advice || '',
            p.manualPrompt || '',
          ]);
        }
      }
    }

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const domain = pagesResults[0] ? new URL(pagesResults[0].meta.url).hostname : 'audit';
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `audit-${domain}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportPdf = useCallback(
    (onStart?: () => void, onEnd?: () => void): void => {
      const { pagesResults, aggregated, mode, activeStatuses, activeThemes } = auditStore.getState();
      if (!aggregated || !pagesResults.length) return;

      onStart?.();

      try {
        const { jsPDF } = window.jspdf;
        const { referential } = auditStore.getState();
        const domain = pagesResults[0] ? new URL(pagesResults[0].meta.url).hostname : 'audit';
        const date = new Date().toLocaleString('fr-FR');
        const title =
          mode === 'a11y' ? 'Accessibilité' : mode === 'eco' ? 'Écoconception' : 'Complet';

        const doc: JsPDFDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageW = 210, pageH = 297, margin = 14, contentW = pageW - margin * 2;
        let y = margin;

        const addPage = (h: number) => {
          if (y + h > pageH - 20) { doc.addPage(); y = margin; }
        };

        const statusColors: Record<string, { bg: number[]; border: number[]; text: number[] }> = {
          NC: { bg: [253, 236, 236], border: [193, 53, 53], text: [193, 53, 53] },
          NT: { bg: [254, 244, 227], border: [217, 119, 6], text: [217, 119, 6] },
          C:  { bg: [230, 243, 235], border: [45, 122, 79], text: [45, 122, 79] },
          NA: { bg: [238, 241, 245], border: [107, 122, 143], text: [107, 122, 143] },
        };

        const severityColors: Record<string, { bg: number[]; border: number[]; text: number[] }> = {
          critique: { bg: [253, 236, 236], border: [193, 53, 53],  text: [193, 53, 53]  },
          majeur:   { bg: [254, 244, 227], border: [217, 119, 6],  text: [217, 119, 6]  },
          mineur:   { bg: [254, 252, 232], border: [161, 129, 0],  text: [161, 129, 0]  },
          ok:       { bg: [230, 243, 235], border: [45, 122, 79],  text: [45, 122, 79]  },
        };

        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 50);
        doc.text(`Rapport d'audit — ${title}`, margin, y); y += 8;

        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 122, 143);
        doc.text(`Site : ${domain} · ${pagesResults.length} page(s) · Généré le ${date}`, margin, y);
        y += 10;

        const renderScore = (kind: 'a11y' | 'eco', label: string, x: number, cardW: number) => {
          const s = aggregated.statusCounts[kind];
          const score = aggregated.scores[kind];
          const scoreRgb: [number, number, number] = score >= 75 ? [45, 122, 79] : score >= 50 ? [217, 119, 6] : [193, 53, 53];
          doc.setFillColor(247, 249, 251);
          doc.roundedRect(x, y, cardW, 18, 1, 1, 'F');
          doc.setFontSize(16); doc.setFont('helvetica', 'bold');
          doc.setTextColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
          doc.text(String(score), x + 4, y + 9);
          doc.setFontSize(7); doc.setFont('helvetica', 'bold');
          doc.setTextColor(107, 122, 143);
          doc.text(label.toUpperCase(), x + 18, y + 5);
          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.text(`${s.C}C · ${s.NC}NC · ${s.NT}NT · ${s.NA}NA`, x + 18, y + 10);
          // Barre de progression
          const barX = x + 18;
          const barW = cardW - 22;
          doc.setFillColor(228, 232, 238);
          doc.roundedRect(barX, y + 13, barW, 2.5, 1, 1, 'F');
          doc.setFillColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
          doc.roundedRect(barX, y + 13, Math.max(1, barW * (score / 100)), 2.5, 1, 1, 'F');
        };

        if (mode === 'both') {
          const cardW = (contentW - 4) / 2;
          renderScore('a11y', 'Accessibilité', margin, cardW);
          renderScore('eco', 'Écoconception', margin + cardW + 4, cardW);
          y += 22;
        } else if (mode === 'a11y') {
          renderScore('a11y', 'Accessibilité', margin, contentW);
          y += 22;
        } else {
          renderScore('eco', 'Écoconception', margin, contentW);
          y += 22;
        }

        // Tableau de comparaison rapide (mode both uniquement)
        if (mode === 'both') {
          const sa = aggregated.statusCounts.a11y;
          const se = aggregated.statusCounts.eco;
          addPage(30);
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin, top: 0, bottom: 0 },
            head: [['Métrique', 'Accessibilité', 'Écoconception']],
            body: [
              ['Score', String(aggregated.scores.a11y), String(aggregated.scores.eco)],
              ['Conforme (C)', String(sa.C), String(se.C)],
              ['Non conforme (NC)', String(sa.NC), String(se.NC)],
              ['À tester (NT)', String(sa.NT), String(se.NT)],
              ['Non applicable (NA)', String(sa.NA), String(se.NA)],
            ],
            styles: { fontSize: 8, cellPadding: 2.5, textColor: [26, 35, 50] },
            headStyles: { fillColor: [247, 249, 251], textColor: [26, 35, 50], fontStyle: 'bold', fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 'auto' },
              1: { halign: 'center', cellWidth: 40 },
              2: { halign: 'center', cellWidth: 40 },
            },
            theme: 'plain', tableLineColor: [228, 232, 238], tableLineWidth: 0.1,
          });
          y = doc.lastAutoTable.finalY + 10;
        }

        const renderSynthTable = (kind: 'a11y' | 'eco', label: string) => {
          const themes = aggregated.themeStats[kind];
          const rows = [...themes.values()].filter((v) => v.total);
          if (!rows.length) return;
          addPage(20);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold');
          doc.setTextColor(26, 35, 50);
          doc.text(`${label} — synthèse par thématique`, margin, y); y += 6;
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin, top: 0, bottom: 0 },
            head: [['Thématique', 'Total', 'C', 'NC', 'NT', 'NA']],
            body: rows.map((v) => [v.theme, String(v.total), String(v.C), String(v.NC), String(v.NT), String(v.NA)]),
            styles: { fontSize: 8, cellPadding: 2.5, textColor: [26, 35, 50] },
            headStyles: { fillColor: [247, 249, 251], textColor: [26, 35, 50], fontStyle: 'bold', fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 16 },
              2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', cellWidth: 14 },
              4: { halign: 'center', cellWidth: 14 }, 5: { halign: 'center', cellWidth: 14 },
            },
            theme: 'plain', tableLineColor: [228, 232, 238], tableLineWidth: 0.1,
          });
          y = doc.lastAutoTable.finalY + 10;
        };

        if (mode === 'a11y' || mode === 'both') renderSynthTable('a11y', 'Accessibilité');
        if (mode === 'eco' || mode === 'both') renderSynthTable('eco', 'Écoconception');

        const renderSection = (kind: 'a11y' | 'eco', label: string) => {
          const map = aggregated.byRule[kind];
          if (!map?.size) return;
          const entries: AggregatedEntry[] = [...map.values()].filter((entry) => {
            if (!entry.aggregateStatus || !activeStatuses.has(entry.aggregateStatus)) return false;
            if (activeThemes.size) {
              if (!activeThemes.has(themeKeyOf(kind, entry.rule, referential))) return false;
            }
            return true;
          });
          if (!entries.length) return;
          sortEntries(entries);

          addPage(14);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold');
          doc.setTextColor(26, 35, 50);
          doc.text(`${label} — détail`, margin, y); y += 8;

          for (const entry of entries) {
            const r = entry.rule;
            const status = entry.aggregateStatus!;
            const colors = kind === 'eco' && r.severity && severityColors[r.severity]
              ? severityColors[r.severity]
              : statusColors[status] ?? statusColors['NA'];
            const badge = kind === 'eco' && r.severity
              ? `${status} · ${r.severity.toUpperCase()}`
              : status;
            const meta = (() => {
              if (kind !== 'a11y') return `RGESN ${r.critere || ''} · ${r.thematique || ''}`;
              if (referential === 'wcag') {
                const wcag = RGAA_TO_WCAG[r.rgaa || ''];
                if (wcag) return `WCAG ${wcag.criterion} · Niveau ${wcag.level}`;
              }
              return `RGAA ${r.rgaa || ''} · N${r.level || ''} · ${r.themeLabel || ''}`;
            })();
            const advice = r.advice ? `Conseil : ${r.advice}` : '';
            const measure = entry.byPage.find((p) => p.measure)?.measure || r.measure || '';
            const measureTxt = measure ? `Mesure : ${measure}` : '';

            const titleLines = doc.splitTextToSize(r.title || '', contentW - 24);
            const adviceLines = advice ? doc.splitTextToSize(advice, contentW - 6) : [];
            const measureLines = measureTxt ? doc.splitTextToSize(measureTxt, contentW - 6) : [];
            const urlCount = Math.min(entry.byPage.length > 1 ? entry.byPage.length : 0, 12);

            const h = 4 + titleLines.length * 4 + 3
              + (adviceLines.length ? adviceLines.length * 3.5 + 1 : 0)
              + (measureLines.length ? measureLines.length * 3.5 + 1 : 0)
              + (urlCount ? urlCount * 3.2 : 0) + 4;
            addPage(h);

            doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            doc.roundedRect(margin, y, contentW, h, 0.8, 0.8, 'F');
            doc.setFillColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.rect(margin, y, 2.5, h, 'F');

            let cy = y + 4;
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.text(badge, margin + 4, cy);

            doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.setTextColor(26, 35, 50);
            doc.text(titleLines, margin + 8, cy);
            cy += titleLines.length * 4 + 2;

            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 122, 143);
            doc.text(
              `${meta} · ${entry.totalCount} occ. · ${entry.byPage.length} page(s)`,
              margin + 4, cy,
            );
            cy += 4;

            if (adviceLines.length) {
              doc.setTextColor(26, 35, 50);
              doc.text(adviceLines, margin + 4, cy);
              cy += adviceLines.length * 3.5 + 1;
            }
            if (measureLines.length) {
              doc.setTextColor(26, 35, 50);
              doc.text(measureLines, margin + 4, cy);
              cy += measureLines.length * 3.5 + 1;
            }
            if (urlCount > 0) {
              doc.setFontSize(7); doc.setTextColor(107, 122, 143);
              for (const p of entry.byPage.slice(0, 12)) {
                doc.text(
                  `• ${p.url} — ${p.status}${p.count ? ` (${p.count})` : ''}`,
                  margin + 5, cy,
                );
                cy += 3.2;
              }
            }
            y += h + 3;
          }
        };

        if (mode === 'a11y' || mode === 'both') renderSection('a11y', 'Accessibilité');
        if (mode === 'eco' || mode === 'both') renderSection('eco', 'Écoconception');

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8); doc.setFont('helvetica', 'normal');
          doc.setTextColor(107, 122, 143);
          doc.text("Rapport généré par l'extension Numérique Responsable", margin, pageH - 10);
          doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' });
        }

        doc.save(`audit-${domain}-${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (err) {
        console.error('PDF generation failed:', err);
      } finally {
        onEnd?.();
      }
    },
    [],
  );

  return { exportCsv, exportPdf };
}
