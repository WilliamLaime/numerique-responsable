import { describe, it, expect } from 'vitest';
import { computeScore, countStatuses, aggregateResults, sortEntries, themeKeyOf } from '../aggregation.js';
import type { AggregatedEntry, PageResult, RuleResult } from '../../types/audit.js';

// Helpers
function makeRuleMap(entries: Array<{ status: 'C' | 'NC' | 'NA' | 'NT' }>) {
  const map = new Map<string, AggregatedEntry>();
  entries.forEach((e, i) => {
    map.set(`rule-${i}`, {
      rule: { id: `rule-${i}`, status: e.status, count: 0, title: '' } as RuleResult,
      totalCount: 0,
      aggregateStatus: e.status,
      byPage: [],
    });
  });
  return map;
}

describe('computeScore', () => {
  it('renvoie 100 si aucune règle C ou NC', () => {
    expect(computeScore(makeRuleMap([{ status: 'NA' }]))).toBe(100);
  });
  it('calcule % C / (C + NC)', () => {
    const map = makeRuleMap([{ status: 'C' }, { status: 'C' }, { status: 'NC' }]);
    expect(computeScore(map)).toBe(67); // 2/3 arrondi
  });
  it('score 0 si tout NC', () => {
    expect(computeScore(makeRuleMap([{ status: 'NC' }, { status: 'NC' }]))).toBe(0);
  });
  it('ignore NT dans le calcul', () => {
    const map = makeRuleMap([{ status: 'C' }, { status: 'NT' }]);
    expect(computeScore(map)).toBe(100); // seul C compte
  });
});

describe('countStatuses', () => {
  it('compte chaque statut correctement', () => {
    const map = makeRuleMap([
      { status: 'C' }, { status: 'C' },
      { status: 'NC' }, { status: 'NA' }, { status: 'NT' }
    ]);
    expect(countStatuses(map)).toEqual({ C: 2, NC: 1, NA: 1, NT: 1 });
  });
});

describe('aggregateResults', () => {
  const rule: RuleResult = {
    id: 'r1', status: 'NC', count: 3, title: 'Test', themeLabel: 'Images',
    rgaa: '1.1', level: 'A',
  };
  const pages: PageResult[] = [
    { a11y: [{ ...rule, status: 'C', count: 1 }], meta: { url: 'https://a.com/page1' } },
    { a11y: [{ ...rule, status: 'NC', count: 2 }], meta: { url: 'https://a.com/page2' } },
  ];

  it('agrège le pire statut par règle', () => {
    const result = aggregateResults(pages, 'a11y');
    expect(result.byRule.a11y.get('r1')?.aggregateStatus).toBe('NC');
  });

  it('additionne les counts', () => {
    const result = aggregateResults(pages, 'a11y');
    expect(result.byRule.a11y.get('r1')?.totalCount).toBe(3);
  });

  it('conserve une entrée par page', () => {
    const result = aggregateResults(pages, 'a11y');
    expect(result.byRule.a11y.get('r1')?.byPage).toHaveLength(2);
  });

  it('calcule le score', () => {
    const result = aggregateResults(pages, 'a11y');
    expect(result.scores.a11y).toBe(0); // 0C, 1NC → 0%
  });
});

describe('sortEntries', () => {
  it('met NC avant C', () => {
    const entries = [
      { rule: { id: 'a', rgaa: '2.1', status: 'C', count: 0, title: '' }, aggregateStatus: 'C', totalCount: 0, byPage: [] },
      { rule: { id: 'b', rgaa: '1.1', status: 'NC', count: 0, title: '' }, aggregateStatus: 'NC', totalCount: 0, byPage: [] },
    ] as AggregatedEntry[];
    sortEntries(entries);
    expect(entries[0].aggregateStatus).toBe('NC');
  });
});

describe('themeKeyOf', () => {
  it('retourne themeLabel pour a11y', () => {
    const rule = { id: 'x', status: 'C', count: 0, title: '', themeLabel: 'Images' } as RuleResult;
    expect(themeKeyOf('a11y', rule)).toBe('Images');
  });
  it('retourne thematique pour eco', () => {
    const rule = { id: 'x', status: 'C', count: 0, title: '', thematique: 'Frontend' } as RuleResult;
    expect(themeKeyOf('eco', rule)).toBe('Frontend');
  });
});

describe('computeScore — cas limites', () => {
  it('arrondit correctement (2/3 = 66.7 → 67)', () => {
    const map = makeRuleMap([{ status: 'C' }, { status: 'C' }, { status: 'NC' }]);
    expect(computeScore(map)).toBe(67);
  });

  it('score 100 si uniquement NT', () => {
    expect(computeScore(makeRuleMap([{ status: 'NT' }, { status: 'NT' }]))).toBe(100);
  });

  it('score 100 si carte vide', () => {
    expect(computeScore(new Map())).toBe(100);
  });

  it('1 C / 99 NC → score 1', () => {
    const entries: Array<{ status: 'C' | 'NC' | 'NA' | 'NT' }> = [
      { status: 'C' },
      ...Array.from({ length: 99 }, () => ({ status: 'NC' as const })),
    ];
    expect(computeScore(makeRuleMap(entries))).toBe(1);
  });

  it('le score est entre 0 et 100 quels que soient les statuts', () => {
    const mixed = makeRuleMap([
      { status: 'C' }, { status: 'NC' }, { status: 'NA' }, { status: 'NT' },
    ]);
    const score = computeScore(mixed);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('aggregateResults — multi-pages', () => {
  it('retourne un score de 100 si toutes les règles sont NA', () => {
    const pages: PageResult[] = [
      { a11y: [{ id: 'r1', status: 'NA', count: 0, title: '', themeLabel: 'Images', rgaa: '1.1', level: 'A' }], meta: { url: 'https://a.com/' } },
    ];
    const result = aggregateResults(pages, 'a11y');
    expect(result.scores.a11y).toBe(100);
  });

  it('fusionne correctement 3 pages avec le pire statut', () => {
    const rule = { id: 'r2', status: 'C' as const, count: 0, title: '', themeLabel: 'Liens', rgaa: '6.1', level: 'A' };
    const pages: PageResult[] = [
      { a11y: [{ ...rule, status: 'C', count: 0 }], meta: { url: 'https://a.com/1' } },
      { a11y: [{ ...rule, status: 'NA', count: 0 }], meta: { url: 'https://a.com/2' } },
      { a11y: [{ ...rule, status: 'NC', count: 5 }], meta: { url: 'https://a.com/3' } },
    ];
    const result = aggregateResults(pages, 'a11y');
    expect(result.byRule.a11y.get('r2')?.aggregateStatus).toBe('NC');
    expect(result.byRule.a11y.get('r2')?.totalCount).toBe(5);
    expect(result.byRule.a11y.get('r2')?.byPage).toHaveLength(3);
  });

  it('countStatuses ne compte que les règles du mode demandé', () => {
    const pages: PageResult[] = [
      {
        a11y: [{ id: 'a1', status: 'NC', count: 1, title: '', themeLabel: 'Images', rgaa: '1.1', level: 'A' }],
        eco:  [{ id: 'e1', status: 'C',  count: 0, title: '', thematique: 'Frontend' }],
        meta: { url: 'https://a.com/' },
      },
    ];
    const resA = aggregateResults(pages, 'a11y');
    const resE = aggregateResults(pages, 'eco');
    expect(resA.statusCounts.a11y).toEqual({ C: 0, NC: 1, NA: 0, NT: 0 });
    expect(resE.statusCounts.eco).toEqual({ C: 1, NC: 0, NA: 0, NT: 0 });
  });
});
