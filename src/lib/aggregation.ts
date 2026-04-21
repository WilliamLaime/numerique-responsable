import type {
  AggregatedEntry,
  AggregatedResult,
  PageResult,
  RuleResult,
  StatusCode,
  StatusCounts,
  ThemeStat,
} from '../types/audit.js';
import {
  RGAA_THEMES_ORDER,
  RGESN_THEMES,
  STATUS_PRIORITY,
  worseStatus,
} from './grading.js';

type Kind = 'a11y' | 'eco';

export function themeKeyOf(kind: Kind, rule: RuleResult): string {
  return kind === 'a11y' ? (rule.themeLabel || '') : (rule.thematique || '');
}

export function aggregateResults(pages: PageResult[], _mode: string): AggregatedResult {
  const byRule: { a11y: Map<string, AggregatedEntry>; eco: Map<string, AggregatedEntry> } = {
    a11y: new Map(),
    eco: new Map(),
  };

  for (const page of pages) {
    for (const kind of ['a11y', 'eco'] as Kind[]) {
      if (!page[kind]) continue;
      for (const issue of page[kind]!) {
        const entry = byRule[kind].get(issue.id) ?? {
          rule: issue,
          totalCount: 0,
          aggregateStatus: null as StatusCode | null,
          byPage: [],
        };
        entry.totalCount += issue.count || 0;
        entry.aggregateStatus = worseStatus(entry.aggregateStatus, issue.status);
        entry.byPage.push({
          url: page.meta.url,
          count: issue.count || 0,
          status: issue.status,
          measure: issue.measure || '',
          samples: issue.samples || [],
          details: issue.details || [],
          manualPrompt: issue.manualPrompt || null,
        });
        byRule[kind].set(issue.id, entry);
      }
    }
  }

  return {
    byRule,
    pages,
    scores: {
      a11y: computeScore(byRule.a11y),
      eco: computeScore(byRule.eco),
    },
    statusCounts: {
      a11y: countStatuses(byRule.a11y),
      eco: countStatuses(byRule.eco),
    },
    themeStats: {
      a11y: groupByTheme('a11y', byRule.a11y),
      eco: groupByTheme('eco', byRule.eco),
    },
  };
}

// Score Tanaguru-like : % de C sur C+NC (NA et NT exclus).
export function computeScore(ruleMap: Map<string, AggregatedEntry>): number {
  let c = 0, nc = 0;
  for (const { aggregateStatus } of ruleMap.values()) {
    if (aggregateStatus === 'C') c++;
    else if (aggregateStatus === 'NC') nc++;
  }
  const denom = c + nc;
  if (!denom) return 100;
  return Math.round((c / denom) * 100);
}

export function countStatuses(ruleMap: Map<string, AggregatedEntry>): StatusCounts {
  const counts: StatusCounts = { C: 0, NC: 0, NA: 0, NT: 0 };
  for (const { aggregateStatus } of ruleMap.values()) {
    if (aggregateStatus && counts[aggregateStatus] !== undefined) {
      counts[aggregateStatus]++;
    }
  }
  return counts;
}

export function groupByTheme(
  kind: Kind,
  ruleMap: Map<string, AggregatedEntry>,
): Map<string, ThemeStat> {
  const order = kind === 'a11y' ? RGAA_THEMES_ORDER : RGESN_THEMES;
  const themes = new Map<string, ThemeStat>(
    order.map((t) => [t, { theme: t, C: 0, NC: 0, NA: 0, NT: 0, total: 0, rules: [] }]),
  );

  for (const entry of ruleMap.values()) {
    const key = themeKeyOf(kind, entry.rule);
    if (!key) continue;
    if (!themes.has(key)) {
      themes.set(key, { theme: key, C: 0, NC: 0, NA: 0, NT: 0, total: 0, rules: [] });
    }
    const bucket = themes.get(key)!;
    if (entry.aggregateStatus && bucket[entry.aggregateStatus] !== undefined) {
      bucket[entry.aggregateStatus]++;
    }
    bucket.total++;
    bucket.rules.push(entry);
  }
  return themes;
}

// NC en premier, puis NT, puis C, puis NA ; critères dans l'ordre numérique.
export function sortEntries(entries: AggregatedEntry[]): AggregatedEntry[] {
  entries.sort((a, b) => {
    const sp =
      (STATUS_PRIORITY[b.aggregateStatus!] ?? -1) -
      (STATUS_PRIORITY[a.aggregateStatus!] ?? -1);
    if (sp) return sp;
    const na = a.rule.rgaa || a.rule.critere || '';
    const nb = b.rule.rgaa || b.rule.critere || '';
    return na.localeCompare(nb, undefined, { numeric: true });
  });
  return entries;
}
