import { describe, it, expect, beforeEach } from 'vitest';
import { auditStore } from '../auditStore.js';

// Récupère une snapshot de l'état courant du store
const state = () => auditStore.getState();
// Reset entre chaque test en recréant l'état initial via beginAudit + setScreen
beforeEach(() => {
  auditStore.setState({
    screen: 'select',
    errorMessage: '',
    mode: null,
    scope: 'site',
    pageLimit: 'all',
    concurrency: 4,
    settleDelay: 800,
    cancelled: false,
    currentCrawlTabs: new Set(),
    auditedCount: 0,
    attemptedCount: 0,
    failedUrls: [],
    pagesResults: [],
    aggregated: null,
    view: 'theme',
    activeTab: 'a11y',
    activeStatuses: new Set(['NC']),
    activeThemes: new Set(),
    savedAudits: [],
  });
});

describe('setScreen', () => {
  it('change l\'ecran', () => {
    state().setScreen('loading');
    expect(state().screen).toBe('loading');
  });
  it('stocke le message d\'erreur', () => {
    state().setScreen('error', 'Page inaccessible');
    expect(state().screen).toBe('error');
    expect(state().errorMessage).toBe('Page inaccessible');
  });
});

describe('beginAudit', () => {
  it('initialise l\'etat d\'execution et passe en loading', () => {
    state().pagesResults.push({} as never);
    state().beginAudit('a11y', 'page', 10, 2, 500);
    const s = state();
    expect(s.screen).toBe('loading');
    expect(s.mode).toBe('a11y');
    expect(s.scope).toBe('page');
    expect(s.pageLimit).toBe(10);
    expect(s.concurrency).toBe(2);
    expect(s.settleDelay).toBe(500);
    expect(s.pagesResults).toHaveLength(0);
    expect(s.auditedCount).toBe(0);
    expect(s.cancelled).toBe(false);
  });
});

describe('crawl tabs', () => {
  it('ajoute et retire un tab', () => {
    state().addCrawlTab(42);
    expect(state().currentCrawlTabs.has(42)).toBe(true);
    state().removeCrawlTab(42);
    expect(state().currentCrawlTabs.has(42)).toBe(false);
  });
  it('clearCrawlTabs vide le set', () => {
    state().addCrawlTab(1);
    state().addCrawlTab(2);
    state().clearCrawlTabs();
    expect(state().currentCrawlTabs.size).toBe(0);
  });
});

describe('pushPageResult', () => {
  it('ajoute le resultat et incremente auditedCount', () => {
    const page = { meta: { url: 'https://a.com' }, a11y: [], eco: [] };
    state().pushPageResult(page);
    expect(state().pagesResults).toHaveLength(1);
    expect(state().auditedCount).toBe(1);
  });
});

describe('recordFailure / incrementAttempted', () => {
  it('enregistre les echecs et les tentatives', () => {
    state().incrementAttempted();
    state().recordFailure('https://fail.com');
    expect(state().attemptedCount).toBe(1);
    expect(state().failedUrls).toContain('https://fail.com');
  });
});

describe('cancelAudit', () => {
  it('positionne cancelled a true', () => {
    state().cancelAudit();
    expect(state().cancelled).toBe(true);
  });
});

describe('finalizeAudit', () => {
  it('agréger les resultats si pagesResults non vide', () => {
    state().beginAudit('a11y', 'page', 'all', 4, 800);
    state().pushPageResult({ meta: { url: 'https://a.com' }, a11y: [], eco: [] });
    state().finalizeAudit();
    expect(state().aggregated).not.toBeNull();
  });
  it('ne fait rien si pagesResults vide', () => {
    state().finalizeAudit();
    expect(state().aggregated).toBeNull();
  });
});

describe('filtres', () => {
  it('toggleStatus ajoute un statut absent', () => {
    // Etat initial : seulement NC. Ajouter C.
    state().toggleStatus('C');
    expect(state().activeStatuses.has('C')).toBe(true);
    expect(state().activeStatuses.has('NC')).toBe(true);
  });

  it('toggleStatus retire un statut present', () => {
    // NC est present par defaut. Le retirer.
    // Le set devient vide → restaure C+NC+NA.
    state().toggleStatus('NC'); // retire NC → vide → restaure tout
    expect(state().activeStatuses.size).toBe(3);
  });

  it('toggleStatus restaure tout si le set devient vide (multi)', () => {
    // Partir d'un etat avec seulement C actif, puis le retirer
    state().toggleStatus('C');      // ajoute C → NC+C
    state().toggleStatus('NC');     // retire NC → C seul
    state().toggleStatus('C');      // retire C → vide → restaure tout
    expect(state().activeStatuses.size).toBe(3);
  });

  it('toggleTheme ajoute et retire un theme', () => {
    state().toggleTheme('Images');
    expect(state().activeThemes.has('Images')).toBe(true);
    state().toggleTheme('Images');
    expect(state().activeThemes.has('Images')).toBe(false);
  });

  it('clearThemes vide les themes actifs', () => {
    state().toggleTheme('Images');
    state().toggleTheme('Liens');
    state().clearThemes();
    expect(state().activeThemes.size).toBe(0);
  });

  it('setActiveTab reset les themes actifs', () => {
    state().toggleTheme('Images');
    state().setActiveTab('eco');
    expect(state().activeTab).toBe('eco');
    expect(state().activeThemes.size).toBe(0);
  });
});

describe('savedAudits', () => {
  it('setSavedAudits remplace la liste', () => {
    const entry = {
      id: 'x', name: 'Test', date: '', hostname: 'a.com',
      mode: 'a11y', scope: 'page', pageLimit: 'all',
      pagesResults: [], auditedCount: 0, attemptedCount: 0, failedUrls: [],
    } as never;
    state().setSavedAudits([entry]);
    expect(state().savedAudits).toHaveLength(1);
  });
});

describe('loadSavedAudit', () => {
  it('charge un audit sauvegarde dans l\'etat courant', () => {
    const entry = {
      id: 'abc', name: 'Test', date: new Date().toISOString(),
      hostname: 'test.com', mode: 'eco' as const, scope: 'site' as const,
      pageLimit: 5, pagesResults: [{ meta: { url: 'https://test.com' }, eco: [] }],
      auditedCount: 1, attemptedCount: 1, failedUrls: [],
    };
    state().loadSavedAudit(entry);
    const s = state();
    expect(s.mode).toBe('eco');
    expect(s.screen).toBe('results');
    expect(s.aggregated).not.toBeNull();
    expect(s.pagesResults).toHaveLength(1);
  });
});
