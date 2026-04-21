import type { StatusCode } from '../types/audit.js';

export const RGESN_THEMES = [
  'Stratégie', 'Spécifications', 'Architecture',
  'Expérience et interface utilisateur', 'Contenus', 'Frontend',
  'Backend', 'Hébergement', 'Algorithmie',
] as const;

export const RGAA_THEMES_ORDER = [
  'Images', 'Cadres', 'Couleurs', 'Multimédia', 'Tableaux',
  'Liens', 'Scripts', 'Éléments obligatoires', 'Structuration',
  'Présentation', 'Formulaires', 'Navigation', 'Consultation',
] as const;

export const STATUS_ORDER: StatusCode[] = ['NC', 'C', 'NA'];

export const STATUS_LABEL: Record<string, string> = {
  C: 'Conforme',
  NC: 'Non conforme',
  NA: 'Non applicable',
};

export const STATUS_PRIORITY: Record<StatusCode, number> = {
  NC: 3,
  NT: 2,
  C: 1,
  NA: 0,
};

export function gradeClass(score: number): string {
  if (score >= 75) return 'grade-good';
  if (score >= 50) return 'grade-warning';
  return 'grade-bad';
}

export function worseStatus(a: StatusCode | null, b: StatusCode | null): StatusCode | null {
  if (!a) return b;
  if (!b) return a;
  return (STATUS_PRIORITY[a] ?? -1) >= (STATUS_PRIORITY[b] ?? -1) ? a : b;
}
