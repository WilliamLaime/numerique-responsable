import { useState, useMemo } from 'react';
import { useAuditStore, auditStore } from '../../store/auditStore';
import { useExport } from '../../hooks/useExport';
import { useStorage } from '../../hooks/useStorage';
import { useModal } from '../../contexts/ModalContext';
import { jumpToElement } from '../../hooks/useAuditRunner';
import { slimPagesResults } from '../../lib/exportUtils';
import { gradeClass, RGAA_TO_WCAG, WCAG_GUIDELINES_ORDER, WCAG_GUIDELINE_LABELS, WCAG_UNDERSTANDING_SLUG } from '../../lib/grading';
import { themeKeyOf, sortEntries } from '../../lib/aggregation';
import { RGAA_THEMES_ORDER, RGESN_THEMES, STATUS_LABEL } from '../../lib/grading';
import { nrToast } from '../../lib/toast';
import type { AggregatedEntry, ByPageEntry, AuditMode, Referential, RuleResult, StatusCode } from '../../types/audit';

const TOOL_A11Y_COVERAGE = Math.round(64 / 107 * 100); // 60
const TOOL_ECO_COVERAGE  = Math.round(18 / 19 * 100);  // 95

interface Props {
  active: boolean;
  startAudit: (mode: AuditMode) => Promise<void>;
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 32;
  const offset = c - (score / 100) * c;
  return (
    <div className={`score-ring ${gradeClass(score)}`}>
      <svg viewBox="0 0 80 80">
        <circle className="track" cx="40" cy="40" r="32" />
        <circle
          className="progress"
          cx="40"
          cy="40"
          r="32"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="value">{score}<span className="percent">%</span></div>
    </div>
  );
}

// ── Issue card ────────────────────────────────────────────────────────────────

function ruleMeta(kind: string, r: RuleResult, referential: Referential = 'rgaa'): string {
  if (kind !== 'a11y') return `RGESN ${r.critere || ''} · ${r.thematique || ''}`;
  if (referential === 'wcag') {
    const wcag = RGAA_TO_WCAG[r.rgaa || ''];
    if (wcag) return `WCAG ${wcag.criterion} · Niveau ${wcag.level} · ${WCAG_GUIDELINE_LABELS[wcag.guideline] || wcag.guideline}`;
  }
  return `RGAA ${r.rgaa || ''} · Niveau ${r.level || ''} · ${r.themeLabel || ''}`;
}

interface IssueCardProps {
  entry: AggregatedEntry;
  kind: string;
  pageInfo?: ByPageEntry;
  referential?: Referential;
  override?: 'C' | 'NC';
  onSetOverride?: (status: 'C' | 'NC') => void;
  onClearOverride?: () => void;
}

function IssueCard({ entry, kind, pageInfo, referential = 'rgaa', override, onSetOverride, onClearOverride }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const r = entry.rule;
  const rawStatus = (pageInfo ? pageInfo.status : entry.aggregateStatus) as StatusCode;
  const status = (!pageInfo && override) ? override : rawStatus;
  const meta = ruleMeta(kind, r, referential);
  const measure = pageInfo
    ? pageInfo.measure
    : entry.byPage.find((p) => p.measure)?.measure || '';
  const manualPrompt = pageInfo
    ? pageInfo.manualPrompt
    : entry.byPage.find((p) => p.manualPrompt)?.manualPrompt;
  const details = pageInfo ? pageInfo.details : entry.byPage[0]?.details || [];
  const count = pageInfo ? pageInfo.count : entry.totalCount;
  const sev = kind === 'eco' ? r.severity : null;

  const samples = pageInfo ? pageInfo.samples : null;

  const pagesBlock = (() => {
    if (pageInfo) {
      return samples?.length ? (
        <div className="samples-list">
          {samples.map((s) => (
            <SampleBtn key={s.auditId} auditId={s.auditId} outer={s.outer || s.selector} pageUrl={pageInfo.url} />
          ))}
        </div>
      ) : null;
    }
    if (entry.byPage.length > 1) {
      return (
        <div className="rule-pages">
          <div className="rule-pages-label">
            {entry.byPage.length} page(s) · {entry.totalCount} occurrence(s)
          </div>
          {entry.byPage.map((p) => (
            <div key={p.url} className="rule-page-item">
              <span className="url">
                {p.url}{' '}
                <span className={`mini-badge status-${p.status}`}>{p.status}</span>
              </span>
              {p.samples?.length ? (
                <div className="samples-list">
                  {p.samples.map((s) => (
                    <SampleBtn key={s.auditId} auditId={s.auditId} outer={s.outer || s.selector} pageUrl={p.url} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      );
    }
    const only = entry.byPage[0];
    return only?.samples?.length ? (
      <div className="samples-list">
        {only.samples.map((s) => (
          <SampleBtn key={s.auditId} auditId={s.auditId} outer={s.outer || s.selector} pageUrl={only.url} />
        ))}
      </div>
    ) : null;
  })();

  return (
    <div className={`issue status-${status}${expanded ? ' expanded' : ''}`} data-id={r.id}>
      <div
        className="issue-header"
        onClick={(ev) => {
          if ((ev.target as Element).closest('.sample-btn')) return;
          if ((ev.target as Element).closest('.issue-details-toggle')) return;
          setExpanded((v) => !v);
        }}
      >
        <span className={`issue-badge status-${status}`} title={STATUS_LABEL[status] || status}>
          {status}
        </span>
        {sev && <span className={`issue-badge sev-${sev}`}>{sev}</span>}
        <div className="issue-title">
          {r.title}
          {kind === 'a11y' && (() => {
            if (referential === 'wcag') {
              const wcag = RGAA_TO_WCAG[r.rgaa || ''];
              if (!wcag) return null;
              const slug = WCAG_UNDERSTANDING_SLUG[wcag.criterion] || wcag.criterion.replace(/\./g, '-');
              return (
                <a
                  className="issue-ref-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.w3.org/WAI/WCAG21/Understanding/${slug}`}
                  title={`Comprendre ${wcag.criterion} sur w3.org`}
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              );
            }
            if (!r.rgaa) return null;
            return (
              <a
                className="issue-ref-link"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${encodeURIComponent(r.rgaa)}`}
                title="Voir le critère sur accessibilite.numerique.gouv.fr"
                onClick={(e) => e.stopPropagation()}
              >
                ↗
              </a>
            );
          })()}
          <div className="issue-meta">{meta}</div>
        </div>
        {count > 0 && <span className="issue-count">{count}</span>}
        <span className="issue-toggle">{expanded ? '▼' : '▶'}</span>
      </div>
      <div className="issue-body">
        {r.advice && <div className="issue-advice">💡 {r.advice}</div>}
        {manualPrompt && rawStatus === 'NT' && !pageInfo && (
          <div className="issue-manual">
            <span>❓ {manualPrompt}</span>
            {override ? (
              <div className="nt-validated">
                <span className={`nt-validated-badge status-${override}`}>
                  ✔ Validé manuellement — {override === 'C' ? 'Conforme' : 'Non conforme'}
                </span>
                <button className="nt-reset-btn" onClick={onClearOverride} title="Annuler la validation">
                  ↺ Réinitialiser
                </button>
              </div>
            ) : (
              <div className="nt-actions">
                <button className="nt-btn nt-c" onClick={() => onSetOverride?.('C')}>✓ Conforme</button>
                <button className="nt-btn nt-nc" onClick={() => onSetOverride?.('NC')}>✗ Non conforme</button>
              </div>
            )}
          </div>
        )}
        {measure && <div className="issue-measure">📊 {measure}</div>}
        {details?.length ? (
          <details className="issue-details-toggle">
            <summary>Détails ({details.length})</summary>
            <ul className="issue-details">
              {details.map((d, i) => (
                <li key={i}>
                  <span className="detail-label">{d.label}</span>
                  <span className="detail-value">{d.value}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {pagesBlock}
      </div>
    </div>
  );
}

function SampleBtn({ auditId, outer, pageUrl }: { auditId: string; outer: string; pageUrl: string }) {
  if (!auditId) {
    return (
      <button className="sample-btn" disabled>
        <span className="sample-code">{outer}</span>
      </button>
    );
  }
  return (
    <button
      className="sample-btn"
      data-audit-id={auditId}
      data-page-url={pageUrl}
      onClick={(e) => {
        e.stopPropagation();
        void jumpToElement(pageUrl, auditId);
      }}
    >
      <span className="sample-code">{outer}</span>
      <span className="jump-icon">↗</span>
    </button>
  );
}

// ── Issues list (3 view modes) ────────────────────────────────────────────────

function IssuesByRule({ entries, kind, referential }: { entries: AggregatedEntry[]; kind: string; referential: Referential }) {
  const manualOverrides = useAuditStore((s) => s.manualOverrides);
  const setManualOverride = useAuditStore((s) => s.setManualOverride);
  const clearManualOverride = useAuditStore((s) => s.clearManualOverride);
  const sorted = sortEntries([...entries]);
  return (
    <>
      {sorted.map((e) => (
        <IssueCard
          key={e.rule.id}
          entry={e}
          kind={kind}
          referential={referential}
          override={manualOverrides[e.rule.id]}
          onSetOverride={(s) => setManualOverride(e.rule.id, s)}
          onClearOverride={() => clearManualOverride(e.rule.id)}
        />
      ))}
    </>
  );
}

function IssuesByTheme({ entries, kind, referential }: { entries: AggregatedEntry[]; kind: string; referential: Referential }) {
  const manualOverrides = useAuditStore((s) => s.manualOverrides);
  const setManualOverride = useAuditStore((s) => s.setManualOverride);
  const clearManualOverride = useAuditStore((s) => s.clearManualOverride);
  const order: readonly string[] = (kind === 'a11y' && referential === 'wcag')
    ? WCAG_GUIDELINES_ORDER
    : kind === 'a11y' ? RGAA_THEMES_ORDER : RGESN_THEMES;
  const themeStats = useAuditStore((s) => s.aggregated!.themeStats[kind as 'a11y' | 'eco']);
  const entryIds = new Set(entries.map((e) => e.rule.id));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sections = [...order]
    .map((name) => themeStats.get(name))
    .filter((v): v is NonNullable<typeof v> => !!v && v.total > 0)
    .map((theme) => {
      const filtered = sortEntries(theme.rules.filter((e) => entryIds.has(e.rule.id)));
      if (!filtered.length) return null;
      const isExpanded = !collapsed.has(theme.theme);
      return (
        <div key={theme.theme} className={`theme-section${isExpanded ? ' expanded' : ''}`}>
          <div
            className="theme-section-header"
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(theme.theme)) next.delete(theme.theme);
                else next.add(theme.theme);
                return next;
              })
            }
          >
            <span className="toggle">{isExpanded ? '▼' : '▶'}</span>
            <span className="theme-section-title">{theme.theme}</span>
            <span className="theme-section-dist">
              <span className="theme-stat C" title="Conforme">✓ {theme.C}</span>
              <span className="theme-stat NC" title="Non conforme">✗ {theme.NC}</span>
              <span className="theme-stat NT" title="Non testé">? {theme.NT}</span>
              <span className="theme-stat NA" title="Non applicable">− {theme.NA}</span>
            </span>
          </div>
          <div className="theme-section-body">
            {filtered.map((e) => (
              <IssueCard
                key={e.rule.id}
                entry={e}
                kind={kind}
                referential={referential}
                override={manualOverrides[e.rule.id]}
                onSetOverride={(s) => setManualOverride(e.rule.id, s)}
                onClearOverride={() => clearManualOverride(e.rule.id)}
              />
            ))}
          </div>
        </div>
      );
    })
    .filter(Boolean);

  if (!sections.length) {
    return <div className="empty-state"><span className="emoji">🎉</span>Aucun critère dans ce filtre.</div>;
  }
  return <>{sections}</>;
}

function IssuesByPage({ entries, kind, referential }: { entries: AggregatedEntry[]; kind: string; referential: Referential }) {
  const activeStatuses = useAuditStore((s) => s.activeStatuses);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pageMap = new Map<string, { entry: AggregatedEntry; pageInfo: ByPageEntry }[]>();
  for (const entry of entries) {
    for (const p of entry.byPage) {
      if (!activeStatuses.has(p.status)) continue;
      if (!pageMap.has(p.url)) pageMap.set(p.url, []);
      pageMap.get(p.url)!.push({ entry, pageInfo: p });
    }
  }

  const groups = [...pageMap.entries()]
    .map(([url, items]) => ({
      url,
      items,
      total: items.reduce((a, x) => a + x.pageInfo.count, 0),
    }))
    .sort((a, b) => b.total - a.total);

  if (!groups.length) {
    return <div className="empty-state"><span className="emoji">🎉</span>Aucun critère dans ce filtre.</div>;
  }

  return (
    <>
      {groups.map((g) => {
        const isExpanded = expanded.has(g.url);
        return (
          <div key={g.url} className={`page-group${isExpanded ? ' expanded' : ''}`}>
            <div
              className="page-group-header"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.url)) next.delete(g.url);
                  else next.add(g.url);
                  return next;
                })
              }
            >
              <span className="toggle">{isExpanded ? '▼' : '▶'}</span>
              <span className="page-url">{g.url}</span>
              <span className="page-count">{g.total}</span>
            </div>
            <div className="page-group-body">
              {g.items.map(({ entry, pageInfo }) => (
                <IssueCard key={entry.rule.id + pageInfo.url} entry={entry} kind={kind} pageInfo={pageInfo} referential={referential} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Main results screen ───────────────────────────────────────────────────────

export default function ResultsScreen({ active, startAudit }: Props) {
  const mode = useAuditStore((s) => s.mode);
  const referential = useAuditStore((s) => s.referential);
  const aggregated = useAuditStore((s) => s.aggregated);
  const pagesResults = useAuditStore((s) => s.pagesResults);
  const auditedCount = useAuditStore((s) => s.auditedCount);
  const attemptedCount = useAuditStore((s) => s.attemptedCount);
  const failedUrls = useAuditStore((s) => s.failedUrls);
  const view = useAuditStore((s) => s.view);
  const setView = useAuditStore((s) => s.setView);
  const activeTab = useAuditStore((s) => s.activeTab);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);
  const activeStatuses = useAuditStore((s) => s.activeStatuses);
  const toggleStatus = useAuditStore((s) => s.toggleStatus);
  const activeThemes = useAuditStore((s) => s.activeThemes);
  const toggleTheme = useAuditStore((s) => s.toggleTheme);
  const clearThemes = useAuditStore((s) => s.clearThemes);
  const setScreen = useAuditStore((s) => s.setScreen);
  const setSelectTab = useAuditStore((s) => s.setSelectTab);

  const manualOverrides = useAuditStore((s) => s.manualOverrides);

  const { exportCsv, exportPdf } = useExport();
  const { saveAudit } = useStorage();
  const { nrPrompt } = useModal();
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!aggregated || !mode) return null;

  const urlLabel =
    pagesResults.length > 1
      ? `${pagesResults.length} pages auditées · ${new URL(pagesResults[0].meta.url).hostname}`
      : pagesResults[0]?.meta.url ?? '';

  const resultTitle =
    mode === 'a11y' ? 'Accessibilité' : mode === 'eco' ? 'Écoconception' : 'Audit complet';

  const handleSave = async () => {
    if (!pagesResults.length) return;
    const hostname = new URL(pagesResults[0].meta.url).hostname;
    const defaultName = `${hostname} — ${new Date().toLocaleString('fr-FR')}`;
    const name = await nrPrompt("Nom de l'audit :", defaultName);
    if (name === null) return;
    const id = 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    try {
      await saveAudit({
        id,
        name: name.trim() || defaultName,
        date: new Date().toISOString(),
        hostname,
        mode,
        scope: getScope(),
        pageLimit: getPageLimit(),
        pagesResults: slimPagesResults(pagesResults),
        auditedCount,
        attemptedCount,
        failedUrls,
        referential,
      });
      nrToast('✓ Audit sauvegardé dans Mes audits');
      setSelectTab('saved');
      setScreen('select');
      requestAnimationFrame(() => {
        const el = document.querySelector(`.saved-item[data-id="${id}"]`);
        if (el) {
          el.classList.add('highlight-new');
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(() => el.classList.remove('highlight-new'), 1800);
        }
      });
    } catch (err) {
      nrToast(
        'Sauvegarde impossible : ' + (err instanceof Error ? err.message : String(err)),
        { tone: 'error', duration: 4000 },
      );
    }
  };

  const getScope = () => auditStore.getState().scope;
  const getPageLimit = () => auditStore.getState().pageLimit;

  // Filtered entries for current tab
  const kind = activeTab as 'a11y' | 'eco';
  const ruleMap = aggregated.byRule[kind];

  const effectiveStatus = (e: AggregatedEntry): StatusCode => {
    const overrides = manualOverrides ?? {};
    return (overrides[e.rule.id] ?? e.aggregateStatus) as StatusCode;
  };

  const entries = [...ruleMap.values()].filter((e) => {
    const es = effectiveStatus(e);
    if (!es || !activeStatuses.has(es)) return false;
    if (view !== 'theme' && activeThemes.size) {
      if (!activeThemes.has(themeKeyOf(kind, e.rule, referential))) return false;
    }
    return true;
  });

  // Theme filter options
  const themeMap = aggregated.themeStats[kind];
  const themeOptions = [...themeMap.entries()].filter(([, v]) => v.total > 0);
  const themeTotal = themeOptions.reduce((a, [, v]) => a + v.total, 0);

  // Scores et compteurs recalculés avec les overrides
  const effectiveStatusCounts = useMemo(() => {
    const compute = (rm: typeof ruleMap) => {
      const c = { C: 0, NC: 0, NA: 0, NT: 0 };
      for (const e of rm.values()) {
        const s = (manualOverrides[e.rule.id] ?? e.aggregateStatus) as StatusCode;
        if (s && s in c) c[s]++;
      }
      return c;
    };
    return {
      a11y: compute(aggregated.byRule.a11y),
      eco: compute(aggregated.byRule.eco),
    };
  }, [aggregated, manualOverrides]);

  const effectiveScores = useMemo(() => {
    const compute = (rm: typeof ruleMap) => {
      let c = 0, nc = 0;
      for (const e of rm.values()) {
        const s = manualOverrides[e.rule.id] ?? e.aggregateStatus;
        if (s === 'C') c++;
        else if (s === 'NC') nc++;
      }
      const d = c + nc;
      return d ? Math.round((c / d) * 100) : 100;
    };
    return {
      a11y: compute(aggregated.byRule.a11y),
      eco: compute(aggregated.byRule.eco),
    };
  }, [aggregated, manualOverrides]);

  const statusCounts = effectiveStatusCounts;
  const scores = effectiveScores;

  const auditCoverage = (k: 'a11y' | 'eco'): number => {
    const { C, NC, NA, NT } = statusCounts[k];
    const total = C + NC + NA + NT;
    return total ? Math.round((C + NC + NA) / total * 100) : 0;
  };

  return (
    <section id="screen-results" className={`screen${active ? ' active' : ''}`}>
      {/* Header */}
      <div className="results-header">
        <button
          id="back-btn"
          className="icon-btn"
          title="Retour"
          aria-label="Retour"
          onClick={() => setScreen('select')}
        >
          ←
        </button>
        <h2 id="results-title">{resultTitle}</h2>
        <div className="header-actions" role="group" aria-label="Actions de l'audit">
          <button
            id="save-btn"
            className="action-btn save"
            title="Sauvegarder dans le plugin"
            onClick={() => void handleSave()}
          >
            <span className="btn-icon" aria-hidden="true">💾</span>
            <span className="btn-label">Sauvegarder</span>
          </button>
          <button
            id="export-csv"
            className="action-btn"
            title="Exporter en CSV"
            onClick={exportCsv}
          >
            <span className="btn-icon" aria-hidden="true">📄</span>
            <span className="btn-label">CSV</span>
          </button>
          <button
            id="export-pdf"
            className="action-btn"
            title="Exporter en PDF"
            disabled={pdfLoading}
            onClick={() => exportPdf(() => setPdfLoading(true), () => setPdfLoading(false))}
          >
            <span className="btn-icon" aria-hidden="true">📑</span>
            <span className="btn-label">{pdfLoading ? 'En cours…' : 'PDF'}</span>
          </button>
        </div>
        <button
          id="rerun-btn"
          className="icon-btn"
          title="Relancer"
          aria-label="Relancer"
          onClick={() => void startAudit(mode)}
        >
          ↻
        </button>
      </div>

      {/* Audited URL */}
      <div id="audited-url" className="audited-url">{urlLabel}</div>

      {/* Scores */}
      <div id="scores" className={`scores${mode === 'both' ? ' dual' : ''}`}>
        {(mode === 'a11y' || mode === 'both') && (
          <div className="score-card">
            <div className="label">Accessibilité</div>
            <ScoreRing score={scores.a11y} />
            <div className="breakdown status-breakdown">
              <span className="status-pill C" title="Conforme">✓ {statusCounts.a11y.C}</span>
              <span className="status-pill NC" title="Non conforme">✗ {statusCounts.a11y.NC}</span>
              <span className="status-pill NT" title="Non testé">? {statusCounts.a11y.NT}</span>
              <span className="status-pill NA" title="Non applicable">− {statusCounts.a11y.NA}</span>
            </div>
          </div>
        )}
        {(mode === 'eco' || mode === 'both') && (
          <div className="score-card">
            <div className="label">Écoconception</div>
            <ScoreRing score={scores.eco} />
            <div className="breakdown status-breakdown">
              <span className="status-pill C" title="Conforme">✓ {statusCounts.eco.C}</span>
              <span className="status-pill NC" title="Non conforme">✗ {statusCounts.eco.NC}</span>
              <span className="status-pill NT" title="Non testé">? {statusCounts.eco.NT}</span>
              <span className="status-pill NA" title="Non applicable">− {statusCounts.eco.NA}</span>
            </div>
          </div>
        )}
      </div>

      {/* Score explanation */}
      <div className="score-legend">
        <p className="legend-title">ℹ️ Calcul du score</p>
        <p className="legend-formula">Score = Conformes ÷ (Conformes + Non conformes) × 100</p>
        <p className="legend-note">Les critères Non testé (NT) et Non applicable (NA) ne sont pas comptabilisés dans le score.</p>
        {(mode === 'a11y' || mode === 'both') && (
          <p className="legend-coverage">
            Accessibilité — <strong>{auditCoverage('a11y')}%</strong> des critères testés lors de cet audit
            &nbsp;·&nbsp; couverture de l'outil : <strong>~{TOOL_A11Y_COVERAGE}%</strong> du RGAA (107 critères)
          </p>
        )}
        {(mode === 'eco' || mode === 'both') && (
          <p className="legend-coverage">
            Écoconception — <strong>{auditCoverage('eco')}%</strong> des critères testés lors de cet audit
            &nbsp;·&nbsp; couverture de l'outil : <strong>~{TOOL_ECO_COVERAGE}%</strong> du RGESN (79 critères)
          </p>
        )}
      </div>

      {/* View toggle */}
      <div id="view-toggle" className="view-toggle" role="tablist">
        {(['theme', 'rule', 'page'] as const).map((v) => (
          <button
            key={v}
            className={`view-btn${view === v ? ' active' : ''}`}
            data-view={v}
            onClick={() => { clearThemes(); setView(v); }}
          >
            {v === 'theme' ? 'Par thématique' : v === 'rule' ? 'Par règle' : 'Par page'}
          </button>
        ))}
      </div>

      {/* Tabs (a11y / eco) — only when mode === 'both' */}
      <div
        className="tabs"
        id="tabs"
        role="tablist"
        style={{ display: mode === 'both' ? 'flex' : 'none' }}
      >
        {mode === 'both' &&
          (['a11y', 'eco'] as const).map((k) => (
            <button
              key={k}
              className={`tab${activeTab === k ? ' active' : ''}`}
              data-key={k}
              onClick={() => setActiveTab(k)}
            >
              {k === 'a11y' ? 'Accessibilité' : 'Écoconception'}
              <span className="count">{aggregated.byRule[k].size}</span>
            </button>
          ))}
      </div>

      {/* Status filters */}
      <div id="status-filters" className="status-filters" style={{ display: 'flex' }}>
        {(['NC', 'NT', 'C', 'NA'] as StatusCode[]).map((code) => (
          <button
            key={code}
            className={`status-chip ${code}${activeStatuses.has(code) ? ' active' : ''}`}
            data-status={code}
            title={code === 'NC' ? 'Critères en échec' : code === 'C' ? 'Critères validés automatiquement' : 'Critères sans objet sur la page'}
            onClick={() => toggleStatus(code)}
          >
            {code === 'NC' ? '✗ Non conforme' : code === 'C' ? '✓ Conforme' : '− Non applicable'}{' '}
            <span className="chip-count">{statusCounts[kind][code]}</span>
          </button>
        ))}
      </div>

      {/* Theme filters (rule / page view only) */}
      <div
        id="theme-filters"
        className="theme-filters"
        style={{ display: view !== 'theme' ? 'flex' : 'none' }}
      >
        {view !== 'theme' && (
          <>
            <button
              className={`theme-chip all${activeThemes.size === 0 ? ' active' : ''}`}
              data-theme="__all"
              onClick={clearThemes}
            >
              Toutes <span className="chip-count">{themeTotal}</span>
            </button>
            {themeOptions.map(([name, v]) => (
              <button
                key={name}
                className={`theme-chip${activeThemes.has(name) ? ' active' : ''}`}
                data-theme={name}
                onClick={() => toggleTheme(name)}
              >
                {name} <span className="chip-count">{v.total}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Issues */}
      <div id="issues" className="issues">
        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="emoji">🎉</span>Aucun critère dans ce filtre.
          </div>
        ) : view === 'theme' ? (
          <IssuesByTheme entries={entries} kind={kind} referential={referential} />
        ) : view === 'rule' ? (
          <IssuesByRule entries={entries} kind={kind} referential={referential} />
        ) : (
          <IssuesByPage entries={entries} kind={kind} referential={referential} />
        )}
      </div>

      {/* Audit summary */}
      <div
        id="audit-summary"
        className={`audit-summary${failedUrls.length > 0 ? ' has-failures' : ''}`}
        style={{ display: attemptedCount ? 'block' : 'none' }}
      >
        <span>✓ {auditedCount} page(s) auditée(s) sur {attemptedCount} tentée(s)</span>
        {failedUrls.length > 0 && (
          <>
            {' '}— {failedUrls.length} échec(s) :
            {failedUrls.slice(0, 5).map((u) => (
              <span key={u}><br />• {u}</span>
            ))}
            {failedUrls.length > 5 && <span><br />… et {failedUrls.length - 5} autre(s)</span>}
          </>
        )}
      </div>
    </section>
  );
}
