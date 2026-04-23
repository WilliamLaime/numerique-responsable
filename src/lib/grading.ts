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

export const WCAG_GUIDELINES_ORDER = [
  '1.1 Alternatives textuelles', '1.2 Médias temporels',
  '1.3 Adaptable', '1.4 Distinguable',
  '2.1 Accessible au clavier', '2.2 Délai suffisant',
  '2.3 Crises et réactions physiques', '2.4 Navigable',
  "2.5 Modalités d'interaction",
  '3.1 Lisible', '3.2 Prévisible', '3.3 Assistance à la saisie',
  '4.1 Compatible',
] as const;

export const WCAG_GUIDELINE_LABELS: Record<string, string> = {
  '1.1': 'Alternatives textuelles', '1.2': 'Médias temporels',
  '1.3': 'Adaptable', '1.4': 'Distinguable',
  '2.1': 'Accessible au clavier', '2.2': 'Délai suffisant',
  '2.3': 'Crises et réactions physiques', '2.4': 'Navigable',
  '2.5': "Modalités d'interaction",
  '3.1': 'Lisible', '3.2': 'Prévisible', '3.3': 'Assistance à la saisie',
  '4.1': 'Compatible',
};

export type WcagMeta = { criterion: string; guideline: string; principle: number; level: string };

export const RGAA_TO_WCAG: Record<string, WcagMeta> = {
  '1.1':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.2':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.3':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.4':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.5':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.6':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.7':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '1.8':{'criterion':'1.4.5','guideline':'1.4','principle':1,'level':'AA'},
  '1.9':{'criterion':'1.1.1','guideline':'1.1','principle':1,'level':'A'},
  '2.1':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '2.2':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '3.1':{'criterion':'1.4.1','guideline':'1.4','principle':1,'level':'A'},
  '3.2':{'criterion':'1.4.3','guideline':'1.4','principle':1,'level':'AA'},
  '3.3':{'criterion':'1.4.3','guideline':'1.4','principle':1,'level':'AA'},
  '4.1':{'criterion':'1.2.1','guideline':'1.2','principle':1,'level':'A'},
  '4.2':{'criterion':'1.2.1','guideline':'1.2','principle':1,'level':'A'},
  '4.3':{'criterion':'1.2.2','guideline':'1.2','principle':1,'level':'A'},
  '4.4':{'criterion':'1.2.3','guideline':'1.2','principle':1,'level':'A'},
  '4.5':{'criterion':'1.2.4','guideline':'1.2','principle':1,'level':'AA'},
  '4.6':{'criterion':'1.2.5','guideline':'1.2','principle':1,'level':'AA'},
  '4.7':{'criterion':'1.2.6','guideline':'1.2','principle':1,'level':'AAA'},
  '4.8':{'criterion':'1.2.8','guideline':'1.2','principle':1,'level':'AAA'},
  '4.9':{'criterion':'1.4.2','guideline':'1.4','principle':1,'level':'A'},
  '4.10':{'criterion':'2.2.2','guideline':'2.2','principle':2,'level':'A'},
  '4.11':{'criterion':'2.1.2','guideline':'2.1','principle':2,'level':'A'},
  '4.12':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '4.13':{'criterion':'1.2.6','guideline':'1.2','principle':1,'level':'AAA'},
  '5.1':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.2':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.3':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.4':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.5':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.6':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.7':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '5.8':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '6.1':{'criterion':'2.4.4','guideline':'2.4','principle':2,'level':'A'},
  '6.2':{'criterion':'2.4.4','guideline':'2.4','principle':2,'level':'A'},
  '6.3':{'criterion':'3.2.4','guideline':'3.2','principle':3,'level':'AA'},
  '6.4':{'criterion':'4.1.1','guideline':'4.1','principle':4,'level':'A'},
  '7.1':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '7.2':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '7.3':{'criterion':'2.1.1','guideline':'2.1','principle':2,'level':'A'},
  '7.4':{'criterion':'3.2.1','guideline':'3.2','principle':3,'level':'A'},
  '7.5':{'criterion':'3.2.2','guideline':'3.2','principle':3,'level':'A'},
  '7.6':{'criterion':'4.1.3','guideline':'4.1','principle':4,'level':'AA'},
  '7.7':{'criterion':'2.1.2','guideline':'2.1','principle':2,'level':'A'},
  '7.8':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '8.1':{'criterion':'4.1.1','guideline':'4.1','principle':4,'level':'A'},
  '8.2':{'criterion':'4.1.1','guideline':'4.1','principle':4,'level':'A'},
  '8.3':{'criterion':'3.1.1','guideline':'3.1','principle':3,'level':'A'},
  '8.4':{'criterion':'3.1.1','guideline':'3.1','principle':3,'level':'A'},
  '8.5':{'criterion':'2.4.2','guideline':'2.4','principle':2,'level':'A'},
  '8.6':{'criterion':'2.4.2','guideline':'2.4','principle':2,'level':'A'},
  '8.7':{'criterion':'3.1.2','guideline':'3.1','principle':3,'level':'AA'},
  '8.8':{'criterion':'3.1.2','guideline':'3.1','principle':3,'level':'AA'},
  '8.9':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '8.10':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '9.1':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '9.2':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '9.3':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '9.4':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '10.1':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '10.2':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '10.3':{'criterion':'1.3.2','guideline':'1.3','principle':1,'level':'A'},
  '10.4':{'criterion':'1.4.4','guideline':'1.4','principle':1,'level':'AA'},
  '10.5':{'criterion':'1.4.1','guideline':'1.4','principle':1,'level':'A'},
  '10.6':{'criterion':'1.4.10','guideline':'1.4','principle':1,'level':'AA'},
  '10.7':{'criterion':'2.4.7','guideline':'2.4','principle':2,'level':'AA'},
  '10.8':{'criterion':'2.4.7','guideline':'2.4','principle':2,'level':'AA'},
  '10.9':{'criterion':'2.4.3','guideline':'2.4','principle':2,'level':'A'},
  '10.10':{'criterion':'1.4.12','guideline':'1.4','principle':1,'level':'AA'},
  '10.11':{'criterion':'1.4.13','guideline':'1.4','principle':1,'level':'AA'},
  '10.12':{'criterion':'2.2.1','guideline':'2.2','principle':2,'level':'A'},
  '10.13':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '10.14':{'criterion':'1.3.4','guideline':'1.3','principle':1,'level':'AA'},
  '11.1':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '11.2':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '11.3':{'criterion':'2.4.6','guideline':'2.4','principle':2,'level':'AA'},
  '11.4':{'criterion':'3.3.2','guideline':'3.3','principle':3,'level':'A'},
  '11.5':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '11.6':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '11.7':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '11.8':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '11.9':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '11.10':{'criterion':'3.3.1','guideline':'3.3','principle':3,'level':'A'},
  '11.11':{'criterion':'3.3.3','guideline':'3.3','principle':3,'level':'AA'},
  '11.12':{'criterion':'3.3.4','guideline':'3.3','principle':3,'level':'AA'},
  '11.13':{'criterion':'1.3.5','guideline':'1.3','principle':1,'level':'AA'},
  '12.1':{'criterion':'2.4.1','guideline':'2.4','principle':2,'level':'A'},
  '12.2':{'criterion':'3.2.3','guideline':'3.2','principle':3,'level':'AA'},
  '12.3':{'criterion':'3.2.3','guideline':'3.2','principle':3,'level':'AA'},
  '12.4':{'criterion':'2.4.5','guideline':'2.4','principle':2,'level':'AA'},
  '12.5':{'criterion':'3.2.3','guideline':'3.2','principle':3,'level':'AA'},
  '12.6':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '12.7':{'criterion':'2.4.1','guideline':'2.4','principle':2,'level':'A'},
  '12.8':{'criterion':'2.4.3','guideline':'2.4','principle':2,'level':'A'},
  '12.9':{'criterion':'2.1.2','guideline':'2.1','principle':2,'level':'A'},
  '12.10':{'criterion':'2.1.4','guideline':'2.1','principle':2,'level':'A'},
  '12.11':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '13.1':{'criterion':'2.2.1','guideline':'2.2','principle':2,'level':'A'},
  '13.2':{'criterion':'3.2.5','guideline':'3.2','principle':3,'level':'AAA'},
  '13.3':{'criterion':'2.2.2','guideline':'2.2','principle':2,'level':'A'},
  '13.4':{'criterion':'2.3.1','guideline':'2.3','principle':2,'level':'A'},
  '13.5':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '13.6':{'criterion':'4.1.2','guideline':'4.1','principle':4,'level':'A'},
  '13.7':{'criterion':'1.3.1','guideline':'1.3','principle':1,'level':'A'},
  '13.8':{'criterion':'3.2.5','guideline':'3.2','principle':3,'level':'AAA'},
  '13.9':{'criterion':'2.2.2','guideline':'2.2','principle':2,'level':'A'},
  '13.10':{'criterion':'1.3.3','guideline':'1.3','principle':1,'level':'A'},
  '13.11':{'criterion':'3.2.2','guideline':'3.2','principle':3,'level':'A'},
  '13.12':{'criterion':'2.2.2','guideline':'2.2','principle':2,'level':'A'},
};

export const WCAG_UNDERSTANDING_SLUG: Record<string, string> = {
  '1.1.1':'non-text-content','1.2.1':'audio-only-and-video-only-prerecorded',
  '1.2.2':'captions-prerecorded','1.2.3':'audio-description-or-media-alternative-prerecorded',
  '1.2.4':'captions-live','1.2.5':'audio-description-prerecorded',
  '1.2.6':'sign-language-prerecorded','1.2.8':'media-alternative-prerecorded',
  '1.3.1':'info-and-relationships','1.3.2':'meaningful-sequence',
  '1.3.3':'sensory-characteristics','1.3.4':'orientation',
  '1.3.5':'identify-input-purpose','1.4.1':'use-of-color',
  '1.4.2':'audio-control','1.4.3':'contrast-minimum',
  '1.4.4':'resize-text','1.4.5':'images-of-text',
  '1.4.10':'reflow','1.4.12':'text-spacing','1.4.13':'content-on-hover-or-focus',
  '2.1.1':'keyboard','2.1.2':'no-keyboard-trap','2.1.4':'character-key-shortcuts',
  '2.2.1':'timing-adjustable','2.2.2':'pause-stop-hide',
  '2.3.1':'three-flashes-or-below-threshold',
  '2.4.1':'bypass-blocks','2.4.2':'page-titled','2.4.3':'focus-order',
  '2.4.4':'link-purpose-in-context','2.4.5':'multiple-ways',
  '2.4.6':'headings-and-labels','2.4.7':'focus-visible',
  '3.1.1':'language-of-page','3.1.2':'language-of-parts',
  '3.2.1':'on-focus','3.2.2':'on-input','3.2.3':'consistent-navigation',
  '3.2.4':'consistent-identification','3.2.5':'change-on-request',
  '3.3.1':'error-identification','3.3.2':'labels-or-instructions',
  '3.3.3':'error-suggestion','3.3.4':'error-prevention-legal-financial-data',
  '4.1.1':'parsing','4.1.2':'name-role-value','4.1.3':'status-messages',
};

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
