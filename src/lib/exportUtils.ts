import type { PageResult, RuleSample } from '../types/audit.js';

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] ?? c));
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Réduit la taille des samples avant stockage : retire outerHTML et plafonne à 3.
export function slimIssues(arr: unknown): unknown {
  if (!Array.isArray(arr)) return arr;
  return arr.map((issue: Record<string, unknown>) => ({
    ...issue,
    samples: Array.isArray(issue.samples)
      ? (issue.samples as RuleSample[])
          .slice(0, 3)
          .map((s) => ({ auditId: s.auditId, selector: s.selector }))
      : issue.samples,
  }));
}

export function slimPagesResults(pagesResults: PageResult[]): PageResult[] {
  return pagesResults.map((page) => ({
    ...page,
    a11y: slimIssues(page.a11y) as PageResult['a11y'],
    eco: slimIssues(page.eco) as PageResult['eco'],
  }));
}
