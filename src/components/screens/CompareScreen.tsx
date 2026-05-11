import { useMemo } from 'react';
import { useAuditStore } from '../../store/auditStore';
import { compareAudits } from '../../lib/comparison';
import type { RuleChange, ScoreDiff } from '../../lib/comparison';
import type { StatusCounts } from '../../types/audit';

interface Props { active: boolean }

function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' +
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function ScoreBlock({ label, diff }: { label: string; diff: ScoreDiff }) {
  const sign = diff.delta > 0 ? '+' : '';
  const cls = diff.delta > 0 ? 'delta-up' : diff.delta < 0 ? 'delta-down' : 'delta-flat';
  return (
    <div className="cmp-score-block">
      <span className="cmp-score-label">{label}</span>
      <span className="cmp-score-values">
        {fmt(diff.a)} → {fmt(diff.b)}
      </span>
      <span className={`cmp-score-delta ${cls}`}>
        {sign}{fmt(diff.delta)} pts
      </span>
    </div>
  );
}

function CountRow({ label, a, b }: { label: string; a: number; b: number }) {
  const delta = b - a;
  const sign = delta > 0 ? '+' : '';
  const cls = label === 'NC'
    ? (delta < 0 ? 'delta-up' : delta > 0 ? 'delta-down' : 'delta-flat')
    : (delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat');
  return (
    <div className="cmp-count-row">
      <span className={`cmp-count-label status-pill ${label}`}>{label}</span>
      <span className="cmp-count-values">{a} → {b}</span>
      {delta !== 0 && <span className={`cmp-count-delta ${cls}`}>{sign}{delta}</span>}
    </div>
  );
}

function RuleRow({ change }: { change: RuleChange }) {
  const ref = change.rgaa ? `RGAA ${change.rgaa}` : change.critere ? `RGESN ${change.critere}` : '';
  return (
    <li className="cmp-rule-row">
      {ref && <span className="cmp-rule-ref">{ref}</span>}
      <span className="cmp-rule-title">{change.title}</span>
    </li>
  );
}

function Section({
  emoji, label, changes, defaultOpen = false,
}: { emoji: string; label: string; changes: RuleChange[]; defaultOpen?: boolean }) {
  if (!changes.length) return null;
  return (
    <details className="cmp-section" open={defaultOpen}>
      <summary className="cmp-section-title">
        <span>{emoji}</span>
        <strong>{changes.length}</strong> {label}
      </summary>
      <ul className="cmp-rule-list">
        {changes.map((c) => <RuleRow key={c.id} change={c} />)}
      </ul>
    </details>
  );
}

export default function CompareScreen({ active }: Props) {
  const clearCompare    = useAuditStore((s) => s.clearCompare);
  const compareAuditIds = useAuditStore((s) => s.compareAuditIds);
  const savedAudits     = useAuditStore((s) => s.savedAudits);

  const [auditA, auditB] = useMemo(() => {
    if (!compareAuditIds) return [null, null];
    const [id1, id2] = compareAuditIds;
    return [
      savedAudits.find((a) => a.id === id1) ?? null,
      savedAudits.find((a) => a.id === id2) ?? null,
    ];
  }, [compareAuditIds, savedAudits]);

  const result = useMemo(() => {
    if (!auditA || !auditB) return null;
    return compareAudits(auditA, auditB);
  }, [auditA, auditB]);

  if (!active) return null;

  if (!auditA || !auditB || !result) {
    return (
      <div id="screen-compare" className="screen active">
        <p className="muted">Audits introuvables.</p>
        <button className="btn-secondary" onClick={clearCompare}>← Retour</button>
      </div>
    );
  }

  const { scores, statusCounts, ameliorations, regressions, nouvelles, resolues, stableNC } = result;
  const hasA11y = !!scores.a11y;
  const hasEco  = !!scores.eco;
  const noDiff  = !ameliorations.length && !regressions.length && !nouvelles.length && !resolues.length;

  const renderCounts = (counts: { a: StatusCounts; b: StatusCounts } | null) => {
    if (!counts) return null;
    return (
      <div className="cmp-counts">
        {(['NC', 'C', 'NT', 'NA'] as const).map((s) => (
          <CountRow key={s} label={s} a={counts.a[s]} b={counts.b[s]} />
        ))}
      </div>
    );
  };

  return (
    <div id="screen-compare" className="screen active">
      <div className="cmp-topbar">
        <button className="btn-back" onClick={clearCompare} title="Retour aux audits sauvegardés">
          ← Retour
        </button>
        <span className="cmp-topbar-title">Comparaison</span>
      </div>

      <div className="cmp-header">
        <div className="cmp-audit-card">
          <span className="cmp-audit-tag">A</span>
          <div>
            <div className="cmp-audit-name">{result.auditA.name}</div>
            <div className="cmp-audit-meta">
              {result.auditA.pages} page(s) · {fmtDate(result.auditA.date)}
            </div>
          </div>
        </div>
        <span className="cmp-vs">⚖</span>
        <div className="cmp-audit-card">
          <span className="cmp-audit-tag cmp-audit-tag-b">B</span>
          <div>
            <div className="cmp-audit-name">{result.auditB.name}</div>
            <div className="cmp-audit-meta">
              {result.auditB.pages} page(s) · {fmtDate(result.auditB.date)}
            </div>
          </div>
        </div>
      </div>

      {hasA11y && (
        <div className="cmp-scores-block">
          <ScoreBlock label="A11y" diff={scores.a11y!} />
          {renderCounts(statusCounts.a11y)}
        </div>
      )}
      {hasEco && (
        <div className="cmp-scores-block">
          <ScoreBlock label="Éco" diff={scores.eco!} />
          {renderCounts(statusCounts.eco)}
        </div>
      )}
      {!hasA11y && !hasEco && (
        <p className="cmp-warning">
          ⚠️ Ces deux audits n'ont pas de mode commun (a11y / éco) — rien à comparer.
        </p>
      )}

      <div className="cmp-diff">
        {noDiff && (hasA11y || hasEco) && (
          <p className="cmp-no-diff">✅ Aucune différence de statut détectée entre les deux audits.</p>
        )}
        <Section emoji="🔴" label="régression(s) — conformes devenus NC" changes={regressions} defaultOpen />
        <Section emoji="🟢" label="amélioration(s) — NC devenus conformes" changes={ameliorations} defaultOpen />
        <Section emoji="🟡" label="nouvelle(s) violation(s) — NT/NA devenus NC" changes={nouvelles} defaultOpen />
        <Section emoji="🔵" label="résolu(e)s — NC devenus NT/NA" changes={resolues} />
        <Section emoji="⚪" label="non-conformité(s) inchangée(s)" changes={stableNC} />
      </div>
    </div>
  );
}
