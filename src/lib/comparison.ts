import { aggregateResults } from './aggregation.js';
import type { SavedAuditEntry, StatusCode, StatusCounts } from '../types/audit.js';

export interface RuleChange {
  id: string;
  title: string;
  rgaa?: string;
  critere?: string;
  themeLabel?: string;
  thematique?: string;
  statusA: StatusCode;
  statusB: StatusCode;
}

export interface ScoreDiff {
  a: number;
  b: number;
  delta: number;
}

export interface CompareResult {
  auditA: { name: string; date: string; pages: number };
  auditB: { name: string; date: string; pages: number };
  scores: { a11y: ScoreDiff | null; eco: ScoreDiff | null };
  statusCounts: { a11y: { a: StatusCounts; b: StatusCounts } | null; eco: { a: StatusCounts; b: StatusCounts } | null };
  ameliorations: RuleChange[];
  regressions: RuleChange[];
  nouvelles: RuleChange[];
  resolues: RuleChange[];
  stableNC: RuleChange[];
}

function hasA11y(mode: string) { return mode === 'a11y' || mode === 'both'; }
function hasEco(mode: string)  { return mode === 'eco'  || mode === 'both'; }

export function compareAudits(a: SavedAuditEntry, b: SavedAuditEntry): CompareResult {
  const aggA = aggregateResults(a.pagesResults, 'both', a.referential ?? 'rgaa');
  const aggB = aggregateResults(b.pagesResults, 'both', b.referential ?? 'rgaa');

  const compareA11y = hasA11y(a.mode) && hasA11y(b.mode);
  const compareEco  = hasEco(a.mode)  && hasEco(b.mode);

  const scores = {
    a11y: compareA11y
      ? { a: aggA.scores.a11y, b: aggB.scores.a11y, delta: aggB.scores.a11y - aggA.scores.a11y }
      : null,
    eco: compareEco
      ? { a: aggA.scores.eco,  b: aggB.scores.eco,  delta: aggB.scores.eco  - aggA.scores.eco  }
      : null,
  };

  const statusCounts = {
    a11y: compareA11y ? { a: aggA.statusCounts.a11y, b: aggB.statusCounts.a11y } : null,
    eco:  compareEco  ? { a: aggA.statusCounts.eco,  b: aggB.statusCounts.eco  } : null,
  };

  const ameliorations: RuleChange[] = [];
  const regressions:   RuleChange[] = [];
  const nouvelles:     RuleChange[] = [];
  const resolues:      RuleChange[] = [];
  const stableNC:      RuleChange[] = [];

  const classify = (kind: 'a11y' | 'eco') => {
    const mapA = aggA.byRule[kind];
    const mapB = aggB.byRule[kind];
    const ids  = new Set([...mapA.keys(), ...mapB.keys()]);

    for (const id of ids) {
      const entA = mapA.get(id);
      const entB = mapB.get(id);
      const sA: StatusCode = entA?.aggregateStatus ?? 'NT';
      const sB: StatusCode = entB?.aggregateStatus ?? 'NT';
      if (sA === sB) {
        if (sA === 'NC') stableNC.push(buildChange(id, entA ?? entB, sA, sB));
        continue;
      }
      const change = buildChange(id, entA ?? entB, sA, sB);
      if (sA === 'NC' && sB === 'C')                       ameliorations.push(change);
      else if (sA === 'C' && sB === 'NC')                  regressions.push(change);
      else if ((sA === 'NT' || sA === 'NA') && sB === 'NC') nouvelles.push(change);
      else if (sA === 'NC' && (sB === 'NT' || sB === 'NA')) resolues.push(change);
    }
  };

  if (compareA11y) classify('a11y');
  if (compareEco)  classify('eco');

  return {
    auditA: { name: a.name, date: a.date, pages: a.pagesResults.length },
    auditB: { name: b.name, date: b.date, pages: b.pagesResults.length },
    scores,
    statusCounts,
    ameliorations,
    regressions,
    nouvelles,
    resolues,
    stableNC,
  };
}

function buildChange(id: string, entry: import('../types/audit.js').AggregatedEntry | undefined, sA: StatusCode, sB: StatusCode): RuleChange {
  const r = entry?.rule;
  return {
    id,
    title: r?.title ?? id,
    rgaa: r?.rgaa,
    critere: r?.critere,
    themeLabel: r?.themeLabel,
    thematique: r?.thematique,
    statusA: sA,
    statusB: sB,
  };
}
