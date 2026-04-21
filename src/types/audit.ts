export type AuditMode = 'a11y' | 'eco' | 'both';
export type AuditScope = 'site' | 'page';
export type StatusCode = 'C' | 'NC' | 'NA' | 'NT';
export type SeverityCode = 'ok' | 'mineur' | 'majeur' | 'critique';

export interface RuleSample {
  auditId: string;
  selector: string;
  outer?: string;
}

export interface RuleDetail {
  label: string;
  value: string;
}

export interface RuleResult {
  id: string;
  status: StatusCode;
  count: number;
  measure?: string;
  samples?: RuleSample[];
  details?: RuleDetail[];
  manualPrompt?: string;
  // Champs RGAA
  rgaa?: string;
  level?: string;
  themeLabel?: string;
  // Champs RGESN
  critere?: string;
  thematique?: string;
  severity?: SeverityCode;
  // Commun
  title: string;
  advice?: string;
}

export interface PageMeta {
  url: string;
  title?: string;
}

export interface PageResult {
  a11y?: RuleResult[];
  eco?: RuleResult[];
  meta: PageMeta;
}

export interface ByPageEntry {
  url: string;
  count: number;
  status: StatusCode;
  measure: string;
  samples: RuleSample[];
  details: RuleDetail[];
  manualPrompt: string | null;
}

export interface AggregatedEntry {
  rule: RuleResult;
  totalCount: number;
  aggregateStatus: StatusCode | null;
  byPage: ByPageEntry[];
}

export interface ThemeStat {
  theme: string;
  C: number;
  NC: number;
  NA: number;
  NT: number;
  total: number;
  rules: AggregatedEntry[];
}

export interface StatusCounts {
  C: number;
  NC: number;
  NA: number;
  NT: number;
}

export interface AggregatedResult {
  byRule: { a11y: Map<string, AggregatedEntry>; eco: Map<string, AggregatedEntry> };
  pages: PageResult[];
  scores: { a11y: number; eco: number };
  statusCounts: { a11y: StatusCounts; eco: StatusCounts };
  themeStats: { a11y: Map<string, ThemeStat>; eco: Map<string, ThemeStat> };
}

export interface SavedAuditEntry {
  id: string;
  name: string;
  date: string;
  hostname: string;
  mode: AuditMode;
  scope: AuditScope;
  pageLimit: number | 'all';
  pagesResults: PageResult[];
  auditedCount: number;
  attemptedCount: number;
  failedUrls: string[];
}
