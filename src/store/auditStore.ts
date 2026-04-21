import { createStore } from 'zustand/vanilla';
import type {
  AggregatedResult,
  AuditMode,
  AuditScope,
  PageResult,
  SavedAuditEntry,
  StatusCode,
} from '../types/audit.js';
import { aggregateResults } from '../lib/aggregation.js';

type Screen = 'select' | 'loading' | 'results' | 'error';
type View = 'theme' | 'rule' | 'page';
type ActiveTab = 'a11y' | 'eco';

interface AuditState {
  // Navigation
  screen: Screen;
  errorMessage: string;

  // Configuration audit
  mode: AuditMode | null;
  scope: AuditScope;
  pageLimit: number | 'all';
  concurrency: number;
  settleDelay: number;

  // Exécution en cours
  cancelled: boolean;
  currentCrawlTabs: Set<number>;
  auditedCount: number;
  attemptedCount: number;
  totalUrls: number;
  failedUrls: string[];
  pagesResults: PageResult[];
  // Progression affichée dans LoadingScreen
  loadingText: string;
  progressUrl: string;

  // Résultats agrégés
  aggregated: AggregatedResult | null;

  // Vue et filtres (écran results)
  view: View;
  activeTab: ActiveTab;
  activeStatuses: Set<StatusCode>;
  activeThemes: Set<string>;

  // Audits sauvegardés
  savedAudits: SavedAuditEntry[];

  // Onglet actif de l'écran select
  selectTab: 'new' | 'saved';
}

interface AuditActions {
  // Écran
  setScreen: (screen: Screen, errorMessage?: string) => void;

  // Config
  setMode: (mode: AuditMode) => void;
  setScope: (scope: AuditScope) => void;
  setPageLimit: (limit: number | 'all') => void;
  setConcurrency: (n: number) => void;
  setSettleDelay: (n: number) => void;

  // Lancement d'audit : réinitialise tout l'état d'exécution
  beginAudit: (
    mode: AuditMode,
    scope: AuditScope,
    pageLimit: number | 'all',
    concurrency: number,
    settleDelay: number,
  ) => void;

  // Progression
  addCrawlTab: (tabId: number) => void;
  removeCrawlTab: (tabId: number) => void;
  clearCrawlTabs: () => void;
  pushPageResult: (result: PageResult) => void;
  recordFailure: (url: string) => void;
  incrementAttempted: () => void;
  setLoadingText: (text: string) => void;
  setProgressUrl: (url: string) => void;
  setTotalUrls: (n: number) => void;

  // Annulation
  cancelAudit: () => void;

  // Résultats
  setAggregated: (result: AggregatedResult) => void;
  finalizeAudit: () => void; // agrège pagesResults → aggregated

  // Vue et filtres
  setView: (view: View) => void;
  setActiveTab: (tab: ActiveTab) => void;
  toggleStatus: (status: StatusCode) => void;
  toggleTheme: (theme: string) => void;
  clearThemes: () => void;

  // Audits sauvegardés
  setSavedAudits: (list: SavedAuditEntry[]) => void;

  // Charger un audit sauvegardé comme état courant
  loadSavedAudit: (entry: SavedAuditEntry) => void;

  // Onglet actif de l'écran select
  setSelectTab: (tab: 'new' | 'saved') => void;
}

const DEFAULT_ACTIVE_STATUSES: StatusCode[] = ['NC'];

export const auditStore = createStore<AuditState & AuditActions>((set, get) => ({
  // ── État initial ──────────────────────────────────────────────────────────

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
  totalUrls: 0,
  failedUrls: [],
  pagesResults: [],
  loadingText: '',
  progressUrl: '',

  aggregated: null,

  view: 'theme',
  activeTab: 'a11y',
  activeStatuses: new Set(DEFAULT_ACTIVE_STATUSES),
  activeThemes: new Set(),

  savedAudits: [],
  selectTab: 'new',

  // ── Actions ───────────────────────────────────────────────────────────────

  setScreen: (screen, errorMessage = '') =>
    set({ screen, errorMessage }),

  setMode: (mode) => set({ mode }),
  setScope: (scope) => set({ scope }),
  setPageLimit: (pageLimit) => set({ pageLimit }),
  setConcurrency: (concurrency) => set({ concurrency }),
  setSettleDelay: (settleDelay) => set({ settleDelay }),

  beginAudit: (mode, scope, pageLimit, concurrency, settleDelay) =>
    set({
      mode,
      scope,
      pageLimit,
      concurrency,
      settleDelay,
      pagesResults: [],
      aggregated: null,
      activeThemes: new Set(),
      activeStatuses: new Set(DEFAULT_ACTIVE_STATUSES),
      activeTab: mode === 'eco' ? 'eco' : 'a11y',
      view: 'theme',
      cancelled: false,
      currentCrawlTabs: new Set(),
      auditedCount: 0,
      attemptedCount: 0,
      totalUrls: 0,
      failedUrls: [],
      loadingText: '',
      progressUrl: '',
      screen: 'loading',
    }),

  addCrawlTab: (tabId) =>
    set((s) => ({ currentCrawlTabs: new Set([...s.currentCrawlTabs, tabId]) })),

  removeCrawlTab: (tabId) =>
    set((s) => {
      const tabs = new Set(s.currentCrawlTabs);
      tabs.delete(tabId);
      return { currentCrawlTabs: tabs };
    }),

  clearCrawlTabs: () => set({ currentCrawlTabs: new Set() }),

  pushPageResult: (result) =>
    set((s) => ({
      pagesResults: [...s.pagesResults, result],
      auditedCount: s.auditedCount + 1,
    })),

  recordFailure: (url) =>
    set((s) => ({ failedUrls: [...s.failedUrls, url] })),

  incrementAttempted: () =>
    set((s) => ({ attemptedCount: s.attemptedCount + 1 })),

  cancelAudit: () => set({ cancelled: true }),

  setLoadingText: (loadingText) => set({ loadingText }),
  setProgressUrl: (progressUrl) => set({ progressUrl }),
  setTotalUrls: (totalUrls) => set({ totalUrls }),

  setAggregated: (aggregated) => set({ aggregated }),

  finalizeAudit: () => {
    const { pagesResults, mode } = get();
    if (!pagesResults.length) return;
    set({ aggregated: aggregateResults(pagesResults, mode ?? 'both') });
  },

  setView: (view) => set({ view }),

  setActiveTab: (activeTab) =>
    set({ activeTab, activeThemes: new Set() }),

  toggleStatus: (status) =>
    set((s) => {
      const next = new Set(s.activeStatuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      // Évite un filtre vide : rétablit tout si le set est vide
      return {
        activeStatuses: next.size
          ? next
          : new Set<StatusCode>(['C', 'NC', 'NA']),
      };
    }),

  toggleTheme: (theme) =>
    set((s) => {
      const next = new Set(s.activeThemes);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return { activeThemes: next };
    }),

  clearThemes: () => set({ activeThemes: new Set() }),

  setSavedAudits: (savedAudits) => set({ savedAudits }),
  setSelectTab: (selectTab) => set({ selectTab }),

  loadSavedAudit: (entry) => {
    const pagesResults = entry.pagesResults;
    const aggregated = aggregateResults(pagesResults, entry.mode);
    set({
      mode: entry.mode,
      scope: entry.scope ?? 'site',
      pageLimit: entry.pageLimit ?? 'all',
      pagesResults,
      auditedCount: entry.auditedCount ?? pagesResults.length,
      attemptedCount: entry.attemptedCount ?? pagesResults.length,
      failedUrls: entry.failedUrls ?? [],
      activeThemes: new Set(),
      activeStatuses: new Set(DEFAULT_ACTIVE_STATUSES),
      activeTab: entry.mode === 'eco' ? 'eco' : 'a11y',
      view: 'theme',
      aggregated,
      screen: 'results',
    });
  },
}));

// Hook React — utilise le store vanilla avec useStore de zustand
import { useStore } from 'zustand';
export type StoreState = AuditState & AuditActions;
export const useAuditStore = <T>(selector: (s: StoreState) => T): T =>
  useStore(auditStore, selector);
