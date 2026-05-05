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
      const { pagesResults, aggregated, mode, activeStatuses, activeThemes, manualOverrides } = auditStore.getState();
      if (!aggregated || !pagesResults.length) return;

      onStart?.();

      try {
        const { jsPDF } = window.jspdf;
        const { referential } = auditStore.getState();

        type StatusKey = 'C' | 'NC' | 'NT' | 'NA';
        const effectiveStatus = (entry: AggregatedEntry) =>
          (manualOverrides[entry.rule.id] ?? entry.aggregateStatus) as StatusKey;

        const computeEffectiveCounts = (kind: 'a11y' | 'eco') => {
          const map = aggregated.byRule[kind];
          if (!map) return { C: 0, NC: 0, NT: 0, NA: 0 };
          const counts = { C: 0, NC: 0, NT: 0, NA: 0 };
          for (const e of map.values()) {
            const s = effectiveStatus(e);
            if (s in counts) counts[s]++;
          }
          return counts;
        };

        const computeEffectiveScore = (counts: { C: number; NC: number; NT: number; NA: number }) => {
          const denom = counts.C + counts.NC;
          return denom ? Math.round(counts.C * 100 / denom) : 100;
        };

        const domain = pagesResults[0] ? new URL(pagesResults[0].meta.url).hostname : 'audit';
        const date = new Date().toLocaleString('fr-FR');
        const title =
          mode === 'a11y' ? 'Accessibilité' : mode === 'eco' ? 'Écoconception' : 'Complet';

        const doc: JsPDFDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        doc.setProperties({
          title: `Rapport d'audit ${title} — ${domain}`,
          subject: `Audit ${title} du ${date}`,
          author: 'Extension Numérique Responsable',
          creator: 'Extension Numérique Responsable (jsPDF)',
          keywords: `accessibilité, écoconception, RGAA, RGESN, ${domain}`,
        });
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
          const s = computeEffectiveCounts(kind);
          const score = computeEffectiveScore(s);
          const scoreRgb: [number, number, number] = score >= 75 ? [45, 122, 79] : score >= 50 ? [217, 119, 6] : [193, 53, 53];
          doc.setFillColor(247, 249, 251);
          doc.roundedRect(x, y, cardW, 26, 1.5, 1.5, 'F');
          // Filet coloré en haut
          doc.setFillColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
          doc.roundedRect(x, y, cardW, 3, 1.5, 1.5, 'F');
          doc.rect(x, y + 1.5, cardW, 1.5, 'F');
          // Score
          doc.setFontSize(26); doc.setFont('helvetica', 'bold');
          doc.setTextColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
          doc.text(String(score), x + 4, y + 18);
          // Label
          doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.setTextColor(107, 122, 143);
          doc.text(label.toUpperCase(), x + 22, y + 9);
          // Stats
          doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
          doc.text(`${s.C}C · ${s.NC}NC · ${s.NT}NT · ${s.NA}NA`, x + 22, y + 14);
          // Barre de progression segmentée (C / NC / NT / NA)
          const barX = x + 22;
          const barW = cardW - 26;
          const total = s.C + s.NC + s.NT + s.NA || 1;
          const segColors: Array<[number, number, number]> = [
            [45, 122, 79],   // C  vert
            [193, 53, 53],   // NC rouge
            [217, 119, 6],   // NT orange
            [107, 122, 143], // NA gris
          ];
          const segCounts = [s.C, s.NC, s.NT, s.NA];
          let segX = barX;
          doc.setFillColor(228, 232, 238);
          doc.roundedRect(barX, y + 19, barW, 2.5, 1, 1, 'F');
          for (let i = 0; i < 4; i++) {
            const w = barW * (segCounts[i] / total);
            if (w < 0.5) { segX += w; continue; }
            doc.setFillColor(segColors[i][0], segColors[i][1], segColors[i][2]);
            doc.rect(segX, y + 19, w, 2.5, 'F');
            segX += w;
          }
        };

        if (mode === 'both') {
          const cardW = (contentW - 4) / 2;
          renderScore('a11y', 'Accessibilité', margin, cardW);
          renderScore('eco', 'Écoconception', margin + cardW + 4, cardW);
          y += 30;
        } else if (mode === 'a11y') {
          renderScore('a11y', 'Accessibilité', margin, contentW);
          y += 30;
        } else {
          renderScore('eco', 'Écoconception', margin, contentW);
          y += 30;
        }

        // Tableau de comparaison rapide (mode both uniquement)
        if (mode === 'both') {
          const sa = computeEffectiveCounts('a11y');
          const se = computeEffectiveCounts('eco');
          addPage(30);
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin, top: 0, bottom: 25 },
            head: [['Métrique', 'Accessibilité', 'Écoconception']],
            body: [
              ['Score', String(computeEffectiveScore(sa)), String(computeEffectiveScore(se))],
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
          const map = aggregated.byRule[kind];
          if (!map?.size) return;
          const themeMap = new Map<string, { theme: string; total: number; C: number; NC: number; NT: number; NA: number }>();
          for (const entry of map.values()) {
            const s = effectiveStatus(entry);
            if (!s) continue;
            const theme = themeKeyOf(kind, entry.rule, referential);
            if (!themeMap.has(theme)) themeMap.set(theme, { theme, total: 0, C: 0, NC: 0, NT: 0, NA: 0 });
            const t = themeMap.get(theme)!;
            t.total++;
            if (s === 'C') t.C++;
            else if (s === 'NC') t.NC++;
            else if (s === 'NT') t.NT++;
            else if (s === 'NA') t.NA++;
          }
          const rows = [...themeMap.values()].filter((v) => v.total);
          if (!rows.length) return;
          addPage(24);
          doc.setFillColor(247, 249, 251);
          doc.roundedRect(margin, y, contentW, 9, 1, 1, 'F');
          doc.setFontSize(11); doc.setFont('helvetica', 'bold');
          doc.setTextColor(26, 35, 50);
          doc.text(`${label} — synthèse par thématique`, margin + 4, y + 6.5); y += 13;
          doc.autoTable({
            startY: y, margin: { left: margin, right: margin, top: 0, bottom: 25 },
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
            const s = effectiveStatus(entry);
            if (!s || !activeStatuses.has(s)) return false;
            if (activeThemes.size) {
              if (!activeThemes.has(themeKeyOf(kind, entry.rule, referential))) return false;
            }
            return true;
          });
          if (!entries.length) return;
          sortEntries(entries);

          doc.addPage(); y = margin;
          doc.setFillColor(26, 35, 50);
          doc.roundedRect(margin, y, contentW, 11, 1.5, 1.5, 'F');
          doc.setFontSize(12); doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(`${label} — détail`, margin + 5, y + 7.5); y += 16;

          for (const entry of entries) {
            const r = entry.rule;
            const status = effectiveStatus(entry);
            const isManual = !!manualOverrides[entry.rule.id];
            const colors = isManual
              ? statusColors[status] ?? statusColors['NA']
              : (kind === 'eco' && r.severity && severityColors[r.severity]
                ? severityColors[r.severity]
                : statusColors[status] ?? statusColors['NA']);
            const badge = isManual
              ? `${status} · MANUEL`
              : (kind === 'eco' && r.severity ? `${status} · ${r.severity.toUpperCase()}` : status);
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

            const titleLines = doc.splitTextToSize(r.title || '', contentW - 8);
            const adviceLines = advice ? doc.splitTextToSize(advice, contentW - 8) : [];
            const measureLines = measureTxt ? doc.splitTextToSize(measureTxt, contentW - 8) : [];
            const urlCount = Math.min(entry.byPage.length > 1 ? entry.byPage.length : 0, 12);

            const h = 5 + 5 + titleLines.length * 4.5 + 3
              + (adviceLines.length ? adviceLines.length * 3.5 + 2 : 0)
              + (measureLines.length ? measureLines.length * 3.5 + 2 : 0)
              + (urlCount ? urlCount * 3.5 : 0) + 5;
            addPage(h);

            doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            doc.roundedRect(margin, y, contentW, h, 0.8, 0.8, 'F');
            doc.setFillColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.rect(margin, y, 2.5, h, 'F');

            let cy = y + 5;
            // Badge sur sa propre ligne
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.text(badge, margin + 4, cy);
            cy += 5;

            // Titre en dessous, pleine largeur
            doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
            doc.setTextColor(26, 35, 50);
            doc.text(titleLines, margin + 4, cy);
            cy += titleLines.length * 4.5 + 2;

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
                cy += 3.5;
              }
            }
            y += h + 5;
          }
        };

        if (mode === 'a11y' || mode === 'both') renderSection('a11y', 'Accessibilité');
        if (mode === 'eco' || mode === 'both') {
          if (mode === 'both') { doc.addPage(); y = margin; }
          renderSection('eco', 'Écoconception');
        }

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

  const exportAi = useCallback(() => {
    const { pagesResults, aggregated, mode, referential } = auditStore.getState();
    if (!aggregated || !pagesResults.length) return;

    const domain = pagesResults[0] ? new URL(pagesResults[0].meta.url).hostname : 'audit';
    const date = new Date().toLocaleDateString('fr-FR');
    const ncA11y = mode !== 'eco' ? (aggregated.statusCounts.a11y?.NC ?? 0) : 0;
    const ncEco = mode !== 'a11y' ? (aggregated.statusCounts.eco?.NC ?? 0) : 0;
    const ref = referential === 'wcag' ? 'WCAG 2.1' : 'RGAA 4.1';

    // ── En-tête / mission ──────────────────────────────────────────────────────
    let md = `# Audit de non-conformités — ${domain}\n`;
    md += `*Généré le ${date} | Référentiel ${ref} + RGESN 2024*\n\n`;
    md += `---\n\n`;
    md += `## Contexte et mission\n\n`;
    md += `Tu es un expert en accessibilité numérique (${ref}) et en éco-conception web (RGESN 2024).\n\n`;
    md += `Le site **${domain}** a été audité automatiquement. `;
    md += `Voici les **${ncA11y} non-conformité(s) accessibilité** et **${ncEco} non-conformité(s) éco-conception** détectées.\n\n`;
    md += `Pour chaque non-conformité, fournis :\n`;
    md += `1. **Le problème concret** — en quoi ça bloque un utilisateur ou impacte l'environnement\n`;
    md += `2. **Le correctif précis** — code HTML/CSS/JS prêt à copier-coller, ou configuration serveur\n`;
    md += `3. **La vérification** — comment confirmer que le problème est résolu\n\n`;
    md += `> Les éléments HTML listés sont des exemples réels trouvés sur le site lors de l'audit.\n\n`;
    md += `---\n\n`;

    const renderKindMd = (kind: 'a11y' | 'eco', sectionLabel: string) => {
      const map = aggregated.byRule[kind];
      if (!map?.size) return '';
      const entries = [...map.values()].filter((e) => e.aggregateStatus === 'NC');
      if (!entries.length) return '';
      sortEntries(entries);

      const total = entries.length;
      let section = `## ${sectionLabel} — ${total} non-conformité(s)\n\n`;

      entries.forEach((entry, idx) => {
        const r = entry.rule;
        const num = idx + 1;
        const sevLabel = kind === 'eco' && r.severity ? ` · ${r.severity.toUpperCase()}` : '';

        // En-tête de la NC
        if (kind === 'a11y') {
          const refLabel = referential === 'wcag'
            ? `WCAG ${RGAA_TO_WCAG[r.rgaa || '']?.criterion || '?'} (niveau ${RGAA_TO_WCAG[r.rgaa || '']?.level || '?'})`
            : `RGAA ${r.rgaa || '?'} (niveau ${r.level || '?'}) · ${r.themeLabel || ''}`;
          section += `### NC ${num}/${total} · ${refLabel}\n`;
        } else {
          section += `### NC${sevLabel} ${num}/${total} · RGESN ${r.critere || '?'} · ${r.thematique || ''}\n`;
        }

        section += `**Règle** : ${r.title || ''}\n\n`;

        // Constat : la mesure agrégée la plus parlante
        const allMeasures = entry.byPage.filter((p) => p.measure).map((p) => p.measure);
        const bestMeasure = allMeasures[0] || r.measure || '';
        if (bestMeasure) {
          section += `**Constat technique** : ${bestMeasure}\n\n`;
        }

        // Conseil du référentiel
        if (r.advice) {
          section += `**Règle à respecter** : ${r.advice}\n\n`;
        }

        // Détails techniques (éco : liste de ressources, timings…)
        const allDetails = entry.byPage.flatMap((p) => p.details || []);
        if (allDetails.length) {
          section += `**Détails mesurés** :\n`;
          for (const d of allDetails.slice(0, 8)) {
            section += `- ${d.label} : ${d.value}\n`;
          }
          section += '\n';
        }

        // Pages et éléments en échec
        const ncPages = entry.byPage.filter((p) => p.status === 'NC');
        const totalOcc = ncPages.reduce((s, p) => s + (p.count || 0), 0);
        section += `**Impact** : ${ncPages.length} page(s) touchée(s)${totalOcc ? ` · ${totalOcc} occurrence(s)` : ''}\n\n`;

        // Samples : les éléments HTML concrets à corriger
        const samplesWithCode = ncPages.flatMap((p) =>
          (p.samples || []).map((s) => ({ page: p.url, code: s.outer || s.selector }))
        ).filter((s) => s.code && s.code !== '?').slice(0, 6);

        if (samplesWithCode.length) {
          section += `**Éléments à corriger** :\n`;
          for (const s of samplesWithCode) {
            const isHtml = s.code.startsWith('<');
            section += `\n*Page :* ${s.page}\n`;
            section += isHtml ? `\`\`\`html\n${s.code}\n\`\`\`\n` : `\`${s.code}\`\n`;
          }
          section += '\n';
        } else {
          // Pas de samples : lister les pages avec leur URL et count
          section += `**Pages concernées** :\n`;
          for (const p of ncPages.slice(0, 8)) {
            section += `- ${p.url}${p.count ? ` (${p.count} élément${p.count > 1 ? 's' : ''} en échec)` : ''}\n`;
          }
          section += '\n';
        }

        section += `---\n\n`;
      });

      return section;
    };

    if (mode === 'a11y' || mode === 'both') md += renderKindMd('a11y', 'Accessibilité');
    if (mode === 'eco' || mode === 'both') md += renderKindMd('eco', 'Éco-conception');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${domain}-${new Date().toISOString().slice(0, 10)}-nc.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { exportCsv, exportPdf, exportAi };
}
