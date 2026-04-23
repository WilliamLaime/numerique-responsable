import { describe, it, expect } from 'vitest';
import { gradeClass, worseStatus, STATUS_PRIORITY, RGAA_THEMES_ORDER, RGESN_THEMES } from '../grading.js';

describe('gradeClass', () => {
  it('retourne grade-good pour score >= 75', () => {
    expect(gradeClass(100)).toBe('grade-good');
    expect(gradeClass(75)).toBe('grade-good');
  });
  it('retourne grade-warning pour score entre 50 et 74', () => {
    expect(gradeClass(74)).toBe('grade-warning');
    expect(gradeClass(50)).toBe('grade-warning');
  });
  it('retourne grade-bad pour score < 50', () => {
    expect(gradeClass(49)).toBe('grade-bad');
    expect(gradeClass(0)).toBe('grade-bad');
  });
});

describe('worseStatus', () => {
  it('NC est pire que tout', () => {
    expect(worseStatus('NC', 'C')).toBe('NC');
    expect(worseStatus('C', 'NC')).toBe('NC');
    expect(worseStatus('NC', 'NA')).toBe('NC');
  });
  it('NT est pire que C et NA', () => {
    expect(worseStatus('NT', 'C')).toBe('NT');
    expect(worseStatus('C', 'NT')).toBe('NT');
  });
  it('C est pire que NA', () => {
    expect(worseStatus('C', 'NA')).toBe('C');
    expect(worseStatus('NA', 'C')).toBe('C');
  });
  it('gère les null', () => {
    expect(worseStatus(null, 'NC')).toBe('NC');
    expect(worseStatus('C', null)).toBe('C');
    expect(worseStatus(null, null)).toBe(null);
  });
});

describe('STATUS_PRIORITY', () => {
  it('NC > NT > C > NA', () => {
    expect(STATUS_PRIORITY.NC).toBeGreaterThan(STATUS_PRIORITY.NT);
    expect(STATUS_PRIORITY.NT).toBeGreaterThan(STATUS_PRIORITY.C);
    expect(STATUS_PRIORITY.C).toBeGreaterThan(STATUS_PRIORITY.NA);
  });
});

describe('constantes thématiques', () => {
  it('RGAA_THEMES_ORDER a 13 thématiques', () => {
    expect(RGAA_THEMES_ORDER).toHaveLength(13);
  });
  it('RGESN_THEMES a 9 thématiques', () => {
    expect(RGESN_THEMES).toHaveLength(9);
  });
});
