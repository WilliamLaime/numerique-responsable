import { describe, it, expect } from 'vitest';
import { csvEscape, escapeHtml, slimIssues, slimPagesResults } from '../exportUtils.js';

describe('csvEscape', () => {
  it('retourne la chaîne telle quelle si pas de caractères spéciaux', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
  it('encadre de guillemets si virgule', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"');
  });
  it('échappe les guillemets internes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('encadre si saut de ligne', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
  it('gère null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('échappe les caractères HTML dangereux', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('gère null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('slimIssues', () => {
  it('garde max 3 samples', () => {
    const issues = [{
      id: 'r1', title: 'Test', status: 'NC', count: 5,
      samples: [
        { auditId: '1', selector: 'a', outer: '<a>1</a>' },
        { auditId: '2', selector: 'b', outer: '<a>2</a>' },
        { auditId: '3', selector: 'c', outer: '<a>3</a>' },
        { auditId: '4', selector: 'd', outer: '<a>4</a>' },
      ]
    }];
    const result = slimIssues(issues) as typeof issues;
    expect(result[0].samples).toHaveLength(3);
  });

  it('retire le champ outer des samples', () => {
    const issues = [{
      id: 'r1', title: '', status: 'C', count: 0,
      samples: [{ auditId: 'a', selector: '.foo', outer: '<div>big</div>' }]
    }];
    const result = slimIssues(issues) as typeof issues;
    expect((result[0].samples[0] as { outer?: string }).outer).toBeUndefined();
    expect(result[0].samples[0].auditId).toBe('a');
    expect(result[0].samples[0].selector).toBe('.foo');
  });

  it('retourne non-array tel quel', () => {
    expect(slimIssues(null)).toBe(null);
    expect(slimIssues('hello')).toBe('hello');
  });
});

describe('slimPagesResults', () => {
  it('slim les issues de chaque page', () => {
    const pages = [{
      a11y: [{ id: 'r1', title: '', status: 'NC' as const, count: 1,
        samples: Array(5).fill({ auditId: 'x', selector: '.a', outer: '<b/>' }) }],
      eco: undefined,
      meta: { url: 'https://example.com' }
    }];
    const result = slimPagesResults(pages);
    expect(result[0].a11y![0].samples).toHaveLength(3);
  });
});
