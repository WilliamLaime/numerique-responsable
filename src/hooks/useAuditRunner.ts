import { useCallback } from 'react';
import { auditStore } from '../store/auditStore';
import { normalizeUrl, addIfSameOrigin } from '../lib/urlUtils';
import { useModal } from '../contexts/ModalContext';
import type { AuditMode, PageResult } from '../types/audit';

const MAX_PAGES_HARD_CAP = 500;
const PAGES_CONFIRM_THRESHOLD = 100;

async function getTargetTab(): Promise<chrome.tabs.Tab | undefined> {
  const params = new URLSearchParams(location.search);
  const targetTabId = params.get('targetTabId');
  if (targetTabId) {
    try { return await chrome.tabs.get(Number(targetTabId)); } catch {}
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function waitForTabLoad(
  tabId: number,
  { totalTimeout = 30000, settleDelay = 800 } = {},
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    };
    const timeout = setTimeout(finish, totalTimeout);
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(finish, settleDelay);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Fix race condition : si le tab était déjà chargé avant l'enregistrement du listener
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      if (tab?.status === 'complete') setTimeout(finish, settleDelay);
    });
  });
}

async function ensurePageReady(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const steps = Math.min(10, Math.ceil(height / window.innerHeight));
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, (height / steps) * i);
          await wait(150);
        }
        window.scrollTo(0, 0);
        let lastCount = performance.getEntriesByType('resource').length;
        for (let i = 0; i < 8; i++) {
          await wait(600);
          const now = performance.getEntriesByType('resource').length;
          if (now === lastCount) return true;
          lastCount = now;
        }
        return true;
      },
    });
  } catch {}
}

async function auditTab(tabId: number, mode: AuditMode): Promise<PageResult | null> {
  await ensurePageReady(tabId);
  if (auditStore.getState().cancelled) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (auditStore.getState().cancelled) return null;
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['audit.js'] });
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        func: (m: string) => (globalThis as any).__nrAudit(m),
        args: [mode],
      });
      if (res?.result) return res.result as PageResult;
    } catch (e) {
      console.warn('auditTab attempt', attempt, 'failed', e);
    }
    if (auditStore.getState().cancelled) return null;
    await new Promise<void>((r) => setTimeout(r, 1000));
  }
  return null;
}

async function fetchSitemap(url: string, depth: number, urls: Set<string>, origin: string): Promise<void> {
  if (depth > 3) return;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    for (const node of doc.querySelectorAll('loc')) {
      const loc = node.textContent?.trim();
      if (!loc) continue;
      if (loc.endsWith('.xml')) {
        await fetchSitemap(loc, depth + 1, urls, origin);
      } else {
        addIfSameOrigin(urls, loc, origin);
      }
    }
  } catch {}
}

async function discoverUrls(startUrl: string, limit: number | 'all'): Promise<string[]> {
  const origin = new URL(startUrl).origin;
  const startNormalized = normalizeUrl(startUrl);
  const urls = new Set<string>([startNormalized]);
  const effectiveLimit = limit === 'all' ? MAX_PAGES_HARD_CAP : limit;

  // Lire robots.txt pour trouver les sitemaps déclarés
  try {
    const res = await fetch(origin + '/robots.txt', { credentials: 'omit' });
    if (res.ok) {
      const text = await res.text();
      const sitemapLines = text.match(/^Sitemap:\s*(.+)$/gim) || [];
      for (const line of sitemapLines) {
        const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim();
        await fetchSitemap(sitemapUrl, 0, urls, origin);
        auditStore.getState().setLoadingText(`Sitemap : ${urls.size} URL(s) trouvée(s)…`);
      }
    }
  } catch {}

  // Fallback sitemap.xml si aucune URL trouvée via robots.txt
  if (urls.size <= 1) {
    await fetchSitemap(origin + '/sitemap.xml', 0, urls, origin);
    if (urls.size > 1) auditStore.getState().setLoadingText(`Sitemap : ${urls.size} URL(s) trouvée(s)…`);
  }

  // Compléter avec les liens de la page courante
  try {
    const tab = await getTargetTab();
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: () =>
        [...document.querySelectorAll('a[href]')].map(
          (a) => (a as HTMLAnchorElement).href,
        ),
    });
    for (const href of (res?.result ?? [])) addIfSameOrigin(urls, href, origin);
    auditStore.getState().setLoadingText(`Découverte : ${urls.size} URL(s) au total…`);
  } catch {}

  const all = [...urls];
  const rest = all.filter((u) => u !== startNormalized).sort();
  return [startNormalized, ...rest].slice(0, effectiveLimit);
}

export async function cancelRunningAudit(): Promise<void> {
  const st = auditStore.getState();
  st.cancelAudit();
  st.setLoadingText('Annulation en cours...');
  for (const tabId of st.currentCrawlTabs) {
    try { await chrome.tabs.remove(tabId); } catch {}
  }
  // Deuxième passe pour attraper les onglets créés pendant l'annulation
  await new Promise((r) => setTimeout(r, 500));
  for (const tabId of auditStore.getState().currentCrawlTabs) {
    try { await chrome.tabs.remove(tabId); } catch {}
  }
  st.clearCrawlTabs();
}

export async function jumpToElement(pageUrl: string, auditId: string): Promise<void> {
  const mode = auditStore.getState().mode;
  if (!mode) return;
  try {
    const tab = await getTargetTab();
    const tabId = tab!.id!;
    let needsRemark = false;

    if (normalizeUrl(pageUrl) !== normalizeUrl(tab.url || '')) {
      await chrome.tabs.update(tabId, { url: pageUrl, active: true });
      await waitForTabLoad(tabId);
      needsRemark = true;
    } else {
      await chrome.tabs.update(tabId, { active: true });
      const [check] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (id: string) =>
          !!document.querySelector(`[data-nr-audit-id="${CSS.escape(id)}"]`),
        args: [auditId],
      });
      if (!check?.result) needsRemark = true;
    }

    if (needsRemark) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['audit.js'] });
      await chrome.scripting.executeScript({
        target: { tabId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        func: (m: string) => (globalThis as any).__nrAudit(m),
        args: [mode],
      });
    }

    await chrome.scripting.executeScript({ target: { tabId }, files: ['highlight.js'] });
    await chrome.scripting.executeScript({
      target: { tabId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      func: (id: string) => (globalThis as any).__nrHighlight(id),
      args: [auditId],
    });
  } catch (e) {
    console.error('jumpToElement failed', e);
  }
}

export async function navigateToPage(url: string): Promise<void> {
  try {
    const tab = await getTargetTab();
    await chrome.tabs.update(tab!.id!, { url, active: true });
  } catch (e) {
    console.error('navigateToPage failed', e);
  }
}

export async function toggleTabOrder(): Promise<boolean> {
  try {
    const tab = await getTargetTab();
    const tabId = tab!.id!;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['taborder.js'] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (globalThis as any).__nrTabOrder(),
    });
    return res?.result ?? false;
  } catch (e) {
    console.error('toggleTabOrder failed', e);
    return false;
  }
}

export function useAuditRunner() {
  const { nrConfirm } = useModal();

  const startAudit = useCallback(
    async (mode: AuditMode) => {
      const st = auditStore.getState();
      const { scope, pageLimit, concurrency, settleDelay } = st;

      st.beginAudit(mode, scope, pageLimit, concurrency, settleDelay);

      try {
        const currentTab = await getTargetTab();
        if (
          !currentTab?.url ||
          /^(chrome|edge|about|chrome-extension|devtools):/.test(currentTab.url)
        ) {
          auditStore.getState().setScreen(
            'error',
            "Ouvrez une page web (http/https) avant de lancer l'audit.",
          );
          return;
        }

        auditStore.getState().setLoadingText(
          scope === 'site' ? 'Préparation du crawl...' : scope === 'urls' ? 'Validation des URLs...' : 'Analyse en cours...',
        );

        let urls: string[] = [];
        if (scope === 'page') {
          urls = [currentTab.url];
        } else if (scope === 'urls') {
          const custom = st.customUrls
            .map((u) => normalizeUrl(u.trim()))
            .filter((u) => u && new URL(u).origin === new URL(currentTab.url).origin);
          if (!custom.length) {
            auditStore.getState().setScreen('error', 'Aucune URL valide du même domaine trouvée.');
            return;
          }
          urls = custom.length > MAX_PAGES_HARD_CAP ? custom.slice(0, MAX_PAGES_HARD_CAP) : custom;
        } else {
          urls = await discoverUrls(currentTab.url, pageLimit);
        }

        if (!urls.length) {
          auditStore.getState().setScreen('error', 'Aucune URL trouvée à auditer.');
          return;
        }

        if (pageLimit === 'all' && urls.length > PAGES_CONFIRM_THRESHOLD) {
          const ok = await nrConfirm(
            `Le site contient ${urls.length} page(s).\nL'audit peut prendre plusieurs minutes.\n\nContinuer ?`,
          );
          if (!ok) {
            auditStore.getState().setScreen('select');
            return;
          }
        }

        auditStore.getState().setTotalUrls(urls.length);
        auditStore.getState().setLoadingText(
          scope === 'site' ? `Analyse de ${urls.length} page(s)...` : 'Analyse de la page...',
        );

        const concurrencyN = Math.max(1, Math.min(concurrency || 4, urls.length));
        let cursor = 0;

        const pickNext = () => {
          if (auditStore.getState().cancelled || cursor >= urls.length) return null;
          const index = cursor++;
          return { url: urls[index], index };
        };

        const auditOne = async ({ url, index }: { url: string; index: number }) => {
          if (auditStore.getState().cancelled) return;
          auditStore.getState().incrementAttempted();

          let tabId: number | null = null;
          let createdTab = false;
          try {
            if (index === 0 && normalizeUrl(url) === normalizeUrl(currentTab?.url || '')) {
              tabId = currentTab!.id!;
            } else {
              const t = await chrome.tabs.create({ url, active: false });
              tabId = t.id!;
              createdTab = true;
              if (auditStore.getState().cancelled) {
                try { await chrome.tabs.remove(tabId); } catch {}
                return;
              }
              auditStore.getState().addCrawlTab(tabId!);
              await waitForTabLoad(tabId!, { settleDelay });
            }
            if (auditStore.getState().cancelled) return;
            const result = await auditTab(tabId!, mode);
            if (result) {
              auditStore.getState().pushPageResult(result);
            } else {
              auditStore.getState().recordFailure(url);
            }
          } catch (err) {
            console.warn('Audit failed for', url, err);
            auditStore.getState().recordFailure(url);
          } finally {
            if (createdTab && tabId) {
              auditStore.getState().removeCrawlTab(tabId);
              try { await chrome.tabs.remove(tabId); } catch {}
            }
            const s = auditStore.getState();
            const done = s.auditedCount + s.failedUrls.length;
            auditStore.getState().setProgressUrl(
              urls.length > 1 ? `${done}/${urls.length} · ${url}` : url,
            );
          }
        };

        const worker = async () => {
          for (let next; (next = pickNext()) !== null;) {
            await auditOne(next);
          }
        };

        await Promise.all(Array.from({ length: concurrencyN }, worker));

        if (auditStore.getState().cancelled) {
          auditStore.getState().setScreen('select');
          return;
        }

        auditStore.getState().setProgressUrl('Terminé');
        auditStore.getState().finalizeAudit();

        const { pagesResults, aggregated } = auditStore.getState();
        if (!pagesResults.length || !aggregated) {
          auditStore
            .getState()
            .setScreen('error', "L'audit n'a retourné aucun résultat exploitable.");
          return;
        }

        auditStore.getState().setScreen('results');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        auditStore.getState().setScreen('error', `Erreur durant l'audit : ${msg}`);
      }
    },
    [nrConfirm],
  );

  return { startAudit };
}
