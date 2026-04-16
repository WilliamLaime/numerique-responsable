const screens = {
  select: document.getElementById('screen-select'),
  loading: document.getElementById('screen-loading'),
  results: document.getElementById('screen-results'),
  error: document.getElementById('screen-error')
};

const RGESN_THEMES = [
  'Stratégie', 'Spécifications', 'Architecture',
  'Expérience et interface utilisateur', 'Contenus', 'Frontend',
  'Backend', 'Hébergement', 'Algorithmie'
];

const MAX_PAGES_HARD_CAP = 500;
const PAGES_CONFIRM_THRESHOLD = 100;

const state = {
  mode: null,
  scope: 'site',
  pageLimit: 'all',
  pagesResults: [],
  aggregated: null,
  view: 'rule',
  activeThemes: new Set(),
  activeTab: 'a11y',
  cancelled: false,
  currentCrawlTabs: new Set(),
  auditedCount: 0,
  attemptedCount: 0,
  failedUrls: [],
  concurrency: 4,
  settleDelay: 800
};

const SETTINGS_KEY = 'nrSettings';
const SETTINGS_DEFAULT = { concurrency: 4, settleDelay: 800 };
const SETTINGS_BOUNDS = {
  concurrency: { min: 1, max: 8 },
  settleDelay: { min: 0, max: 5000 }
};

function clampSetting(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SETTINGS_DEFAULT[key];
  const { min, max } = SETTINGS_BOUNDS[key];
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ---------------- Navigation ----------------
function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

document.querySelectorAll('.audit-card').forEach(btn => {
  btn.addEventListener('click', () => startAudit(btn.dataset.mode));
});
document.getElementById('back-btn').addEventListener('click', () => show('select'));
document.getElementById('rerun-btn').addEventListener('click', () => startAudit(state.mode));
document.getElementById('error-back').addEventListener('click', () => show('select'));
document.getElementById('cancel-btn').addEventListener('click', cancelAudit);

async function cancelAudit() {
  state.cancelled = true;
  document.getElementById('loading-text').textContent = "Annulation en cours...";
  for (const tabId of state.currentCrawlTabs) {
    try { await chrome.tabs.remove(tabId); } catch {}
  }
  state.currentCrawlTabs.clear();
}
document.getElementById('detach-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'detach-window' });
});
if (new URLSearchParams(location.search).get('mode') === 'window') {
  document.getElementById('detach-btn').style.display = 'none';
}

document.querySelectorAll('input[name="scope"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('crawl-options').style.display =
      document.querySelector('input[name="scope"]:checked').value === 'site' ? 'block' : 'none';
  });
});

// Dialogues custom — les dialogues natifs (prompt/alert/confirm) sont bloqués
// silencieusement dans un Chrome side panel, donc inutilisables ici.
function nrDialog({ message, withInput, defaultValue, okLabel = 'OK', cancelLabel = 'Annuler', hideCancel = false }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('nr-modal');
    const msgEl = document.getElementById('nr-modal-message');
    const input = document.getElementById('nr-modal-input');
    const okBtn = document.getElementById('nr-modal-ok');
    const cancelBtn = document.getElementById('nr-modal-cancel');

    msgEl.textContent = message;
    input.hidden = !withInput;
    input.value = withInput ? (defaultValue ?? '') : '';
    okBtn.textContent = okLabel;
    cancelBtn.textContent = cancelLabel;
    cancelBtn.hidden = hideCancel;
    overlay.hidden = false;

    if (withInput) {
      setTimeout(() => { input.focus(); input.select(); }, 0);
    } else {
      setTimeout(() => okBtn.focus(), 0);
    }

    function cleanup(result) {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk()     { cleanup(withInput ? input.value : true); }
    function onCancel() { cleanup(withInput ? null : false); }
    function onOverlay(e) { if (e.target === overlay && !hideCancel) onCancel(); }
    function onKey(e) {
      if (e.key === 'Escape' && !hideCancel) onCancel();
      else if (e.key === 'Enter' && (withInput || document.activeElement === okBtn)) onOk();
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}
function nrPrompt(message, defaultValue = '') { return nrDialog({ message, withInput: true, defaultValue }); }
function nrConfirm(message) { return nrDialog({ message, withInput: false }); }
function nrAlert(message) { return nrDialog({ message, withInput: false, hideCancel: true }); }

// Toast léger pour les messages de confirmation (ex : après sauvegarde).
function nrToast(message, { duration = 2200, tone = 'success' } = {}) {
  let host = document.getElementById('nr-toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'nr-toast';
    host.className = 'nr-toast';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  host.textContent = message;
  host.dataset.tone = tone;
  host.classList.add('show');
  clearTimeout(host._nrTimer);
  host._nrTimer = setTimeout(() => host.classList.remove('show'), duration);
}

// Export / save buttons
document.getElementById('export-csv').addEventListener('click', exportCsv);
document.getElementById('export-pdf').addEventListener('click', exportPdf);
document.getElementById('save-btn').addEventListener('click', saveCurrentAudit);

// Onglets de l'écran d'accueil (Nouvel audit / Mes audits)
function activatePanel(name) {
  document.querySelectorAll('.select-tab').forEach(t => {
    const active = t.dataset.panel === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.select-panel').forEach(p => {
    const active = p.id === `panel-${name}`;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
}

document.querySelectorAll('.select-tab').forEach(tab => {
  tab.addEventListener('click', () => activatePanel(tab.dataset.panel));
});

// Load saved audits on startup
(async () => {
  await migrateLegacyLocalStorage();
  await refreshSavedList();
  await loadAdvancedSettings();
})();

async function loadAdvancedSettings() {
  const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...SETTINGS_DEFAULT, ...(saved || {}) };
  state.concurrency = clampSetting('concurrency', settings.concurrency);
  state.settleDelay = clampSetting('settleDelay', settings.settleDelay);

  const concurrencyInput = document.getElementById('opt-concurrency');
  const settleInput = document.getElementById('opt-settle-delay');
  if (concurrencyInput) concurrencyInput.value = state.concurrency;
  if (settleInput) settleInput.value = state.settleDelay;

  const persist = () => chrome.storage.local.set({
    [SETTINGS_KEY]: { concurrency: state.concurrency, settleDelay: state.settleDelay }
  });
  concurrencyInput?.addEventListener('change', () => {
    state.concurrency = clampSetting('concurrency', concurrencyInput.value);
    concurrencyInput.value = state.concurrency;
    persist();
  });
  settleInput?.addEventListener('change', () => {
    state.settleDelay = clampSetting('settleDelay', settleInput.value);
    settleInput.value = state.settleDelay;
    persist();
  });
}

// View toggle
document.querySelectorAll('.view-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.view = b.dataset.view;
    renderIssues();
  });
});

// ---------------- Audit flow ----------------
async function startAudit(mode) {
  state.mode = mode;
  state.scope = document.querySelector('input[name="scope"]:checked').value;
  const rawLimit = document.getElementById('page-limit').value;
  state.pageLimit = rawLimit === 'all' ? 'all' : parseInt(rawLimit, 10);
  const concurrencyInput = document.getElementById('opt-concurrency');
  const settleInput = document.getElementById('opt-settle-delay');
  if (concurrencyInput) state.concurrency = clampSetting('concurrency', concurrencyInput.value);
  if (settleInput) state.settleDelay = clampSetting('settleDelay', settleInput.value);
  state.pagesResults = [];
  state.activeThemes = new Set();
  state.cancelled = false;
  state.currentCrawlTabs = new Set();
  state.auditedCount = 0;
  state.attemptedCount = 0;
  state.failedUrls = [];

  document.getElementById('loading-text').textContent =
    state.scope === 'site' ? "Préparation du crawl..." : "Analyse en cours...";
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-url').textContent = '';
  show('loading');

  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currentTab || !currentTab.url || /^(chrome|edge|about|chrome-extension|devtools):/.test(currentTab.url)) {
      document.getElementById('error-message').textContent =
        "Ouvrez une page web (http/https) avant de lancer l'audit.";
      show('error');
      return;
    }

    const urls = state.scope === 'page'
      ? [currentTab.url]
      : await discoverUrls(currentTab.url, state.pageLimit);

    if (!urls.length) {
      document.getElementById('error-message').textContent = "Aucune URL trouvée à auditer.";
      show('error');
      return;
    }

    if (state.pageLimit === 'all' && urls.length > PAGES_CONFIRM_THRESHOLD) {
      const ok = await nrConfirm(
        `Le site contient ${urls.length} page(s).\nL'audit peut prendre plusieurs minutes.\n\nContinuer ?`
      );
      if (!ok) { show('select'); return; }
    }

    document.getElementById('loading-text').textContent =
      state.scope === 'site' ? `Analyse de ${urls.length} page(s)...` : "Analyse de la page...";

    // Pool de workers : N pages auditées en parallèle via des onglets
    // d'arrière-plan indépendants. Les workers se partagent un curseur commun
    // dans l'ordre d'entrée de la liste d'URLs.
    const concurrency = Math.max(1, Math.min(state.concurrency || 4, urls.length));
    let cursor = 0;
    const pickNext = () => {
      if (state.cancelled || cursor >= urls.length) return null;
      const index = cursor++;
      return { url: urls[index], index };
    };

    const auditOne = async ({ url, index }) => {
      if (state.cancelled) return;
      state.attemptedCount++;
      updateProgress(state.attemptedCount - 1, urls.length, url);
      let tabId = null, createdTab = false;
      try {
        if (index === 0 && url === currentTab.url) {
          tabId = currentTab.id;
        } else {
          const t = await chrome.tabs.create({ url, active: false });
          tabId = t.id;
          createdTab = true;
          state.currentCrawlTabs.add(tabId);
          await waitForTabLoad(tabId, { settleDelay: state.settleDelay });
        }
        if (state.cancelled) return;
        const pageResult = await auditTab(tabId, state.mode);
        if (pageResult) {
          state.pagesResults.push(pageResult);
          state.auditedCount++;
        } else {
          state.failedUrls.push(url);
        }
      } catch (err) {
        console.warn('Audit failed for', url, err);
        state.failedUrls.push(url);
      } finally {
        if (createdTab && tabId) {
          state.currentCrawlTabs.delete(tabId);
          try { await chrome.tabs.remove(tabId); } catch {}
        }
        updateProgress(state.auditedCount + state.failedUrls.length, urls.length, url);
      }
    };

    const worker = async () => {
      for (let next; (next = pickNext()); ) await auditOne(next);
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    if (state.cancelled) {
      show('select');
      return;
    }

    updateProgress(urls.length, urls.length, 'Terminé');

    if (!state.pagesResults.length) {
      document.getElementById('error-message').textContent = "L'audit n'a retourné aucun résultat exploitable.";
      show('error');
      return;
    }

    state.aggregated = aggregateResults(state.pagesResults, state.mode);
    renderResults();
    show('results');
  } catch (e) {
    console.error(e);
    document.getElementById('error-message').textContent = "Erreur durant l'audit : " + (e.message || e);
    show('error');
  }
}

function updateProgress(done, total, url) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-url').textContent =
    total > 1 ? `${done}/${total} · ${url}` : url;
}

async function auditTab(tabId, mode) {
  await ensurePageReady(tabId);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['audit.js'] });
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (m) => globalThis.__nrAudit(m),
        args: [mode]
      });
      if (res?.result) return res.result;
    } catch (e) {
      console.warn('auditTab attempt', attempt, 'failed', e);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

function waitForTabLoad(tabId, { totalTimeout = 30000, settleDelay = 800 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timeout); resolve(); } };
    const timeout = setTimeout(finish, totalTimeout);
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(finish, settleDelay);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Déclenche un scroll complet pour forcer les lazy-loads / IntersectionObserver,
// puis attend que les ressources soient stables.
async function ensurePageReady(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const steps = Math.min(10, Math.ceil(height / window.innerHeight));
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, (height / steps) * i);
          await wait(150);
        }
        window.scrollTo(0, 0);
        // Attend que le réseau soit stable (pas de nouvelle ressource pendant 600 ms)
        let lastCount = performance.getEntriesByType('resource').length;
        for (let i = 0; i < 8; i++) {
          await wait(600);
          const now = performance.getEntriesByType('resource').length;
          if (now === lastCount) return true;
          lastCount = now;
        }
        return true;
      }
    });
  } catch (e) { /* ignore */ }
}

// ---------------- URL discovery ----------------
// Collecte exhaustivement les URLs du site (sitemap + liens internes),
// puis retourne une liste triée déterministe (page courante en tête).
// limit = nombre ou 'all' (plafonné à MAX_PAGES_HARD_CAP).
async function discoverUrls(startUrl, limit) {
  const origin = new URL(startUrl).origin;
  const startNormalized = normalizeUrl(startUrl);
  const urls = new Set([startNormalized]);
  const effectiveLimit = limit === 'all' ? MAX_PAGES_HARD_CAP : limit;

  // 1) Sitemap — collecte exhaustive (sans break prématuré)
  try {
    const res = await fetch(origin + '/sitemap.xml', { credentials: 'omit' });
    if (res.ok) {
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const locs = [...doc.querySelectorAll('loc')].map(n => n.textContent.trim());
      for (const loc of locs) {
        if (loc.endsWith('.xml')) {
          try {
            const sub = await fetch(loc, { credentials: 'omit' });
            if (sub.ok) {
              const subDoc = new DOMParser().parseFromString(await sub.text(), 'text/xml');
              subDoc.querySelectorAll('loc').forEach(n => addIfSameOrigin(urls, n.textContent.trim(), origin));
            }
          } catch {}
        } else {
          addIfSameOrigin(urls, loc, origin);
        }
      }
    }
  } catch { /* no sitemap */ }

  // 2) Complément : liens internes de la page courante
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => [...document.querySelectorAll('a[href]')].map(a => a.href)
    });
    for (const href of (res?.result || [])) addIfSameOrigin(urls, href, origin);
  } catch {}

  // Tri déterministe : page courante en tête, reste alphabétique
  const all = [...urls];
  const rest = all.filter(u => u !== startNormalized).sort();
  return [startNormalized, ...rest].slice(0, effectiveLimit);
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    // Supprimer paramètres de tracking
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid']
      .forEach(p => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, '');
  } catch { return u; }
}

function addIfSameOrigin(set, href, origin) {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin) return;
    if (!/^https?:$/.test(u.protocol)) return;
    if (/\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|mp4|mp3|doc|docx|xls|xlsx)(\?|$)/i.test(u.pathname)) return;
    set.add(normalizeUrl(u.toString()));
  } catch {}
}

// ---------------- Aggregation ----------------
function aggregateResults(pages, mode) {
  const byRule = { a11y: new Map(), eco: new Map() };
  for (const page of pages) {
    for (const kind of ['a11y', 'eco']) {
      if (!page[kind]) continue;
      for (const issue of page[kind]) {
        const entry = byRule[kind].get(issue.id) || {
          rule: issue, totalCount: 0, byPage: []
        };
        entry.totalCount += issue.count;
        entry.byPage.push({ url: page.meta.url, count: issue.count, samples: issue.samples });
        byRule[kind].set(issue.id, entry);
      }
    }
  }

  const scoreOf = (kind) => {
    const vals = pages.map(p => computePageScore(p[kind] || [], p.meta[kind + 'Total'] || 0));
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0) / vals.length) : 100;
  };

  return {
    byRule,
    pages,
    scores: { a11y: scoreOf('a11y'), eco: scoreOf('eco') },
    themeCounts: countThemes(byRule.eco)
  };
}

function computePageScore(issues, total) {
  if (!total) return 100;
  const weights = { critique: 10, majeur: 4, mineur: 1 };
  const penalty = issues.reduce((a, i) => a + (weights[i.severity] || 2), 0);
  return Math.max(0, Math.round(100 - (penalty / (total * 10)) * 100));
}

function countThemes(byRuleMap) {
  const counts = Object.fromEntries(RGESN_THEMES.map(t => [t, 0]));
  for (const { rule } of byRuleMap.values()) {
    if (counts[rule.thematique] !== undefined) counts[rule.thematique]++;
  }
  return counts;
}

function gradeClass(score) {
  if (score >= 75) return 'grade-good';
  if (score >= 50) return 'grade-warning';
  return 'grade-bad';
}

// ---------------- Rendering ----------------
function renderResults() {
  const mode = state.mode;
  document.getElementById('results-title').textContent =
    mode === 'a11y' ? 'Accessibilité' : mode === 'eco' ? 'Écoconception' : 'Audit complet';

  const urlLabel = state.pagesResults.length > 1
    ? `${state.pagesResults.length} pages auditées · ${new URL(state.pagesResults[0].meta.url).hostname}`
    : state.pagesResults[0].meta.url;
  document.getElementById('audited-url').textContent = urlLabel;

  renderScores();
  renderTabs();
  renderThemeFilters();
  renderIssues();
  renderAuditSummary();
}

function renderAuditSummary() {
  const el = document.getElementById('audit-summary');
  const { auditedCount, attemptedCount, failedUrls } = state;
  if (!attemptedCount) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const failed = failedUrls.length;
  el.classList.toggle('has-failures', failed > 0);
  let txt = `✓ ${auditedCount} page(s) auditée(s) sur ${attemptedCount} tentée(s)`;
  if (failed > 0) {
    txt += ` — ${failed} échec(s) :<br>` + failedUrls.slice(0, 5).map(u => `• ${escapeHtml(u)}`).join('<br>');
    if (failed > 5) txt += `<br>… et ${failed - 5} autre(s)`;
  }
  el.innerHTML = txt;
}

function renderScores() {
  const el = document.getElementById('scores');
  const mode = state.mode;
  el.classList.toggle('dual', mode === 'both');

  const ring = (score) => {
    const c = 2 * Math.PI * 32;
    const offset = c - (score / 100) * c;
    return `<div class="score-ring ${gradeClass(score)}">
      <svg viewBox="0 0 80 80">
        <circle class="track" cx="40" cy="40" r="32"></circle>
        <circle class="progress" cx="40" cy="40" r="32"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="value">${score}</div>
    </div>`;
  };

  let html = '';
  if (mode === 'a11y' || mode === 'both') {
    const total = Array.from(state.aggregated.byRule.a11y.values()).reduce((a,e)=>a+e.totalCount,0);
    html += `
      <div class="score-card">
        <div class="label">Accessibilité</div>
        ${ring(state.aggregated.scores.a11y)}
        <div class="breakdown"><strong>${state.aggregated.byRule.a11y.size}</strong> règles en défaut · <strong>${total}</strong> occurrence(s)</div>
      </div>`;
  }
  if (mode === 'eco' || mode === 'both') {
    const total = Array.from(state.aggregated.byRule.eco.values()).reduce((a,e)=>a+e.totalCount,0);
    html += `
      <div class="score-card">
        <div class="label">Écoconception</div>
        ${ring(state.aggregated.scores.eco)}
        <div class="breakdown"><strong>${state.aggregated.byRule.eco.size}</strong> règles en défaut · <strong>${total}</strong> occurrence(s)</div>
      </div>`;
  }
  el.innerHTML = html;
}

function renderTabs() {
  const el = document.getElementById('tabs');
  el.innerHTML = '';
  const mode = state.mode;
  const tabs = [];
  if (mode === 'a11y' || mode === 'both') tabs.push({ key: 'a11y', label: 'Accessibilité' });
  if (mode === 'eco' || mode === 'both') tabs.push({ key: 'eco', label: 'Écoconception' });

  if (tabs.length <= 1) {
    el.style.display = 'none';
    state.activeTab = tabs[0]?.key || 'a11y';
    return;
  }
  el.style.display = 'flex';
  state.activeTab = tabs[0].key;

  tabs.forEach((t, i) => {
    const count = state.aggregated.byRule[t.key].size;
    const b = document.createElement('button');
    b.className = 'tab' + (i === 0 ? ' active' : '');
    b.dataset.key = t.key;
    b.innerHTML = `${t.label}<span class="count">${count}</span>`;
    b.addEventListener('click', () => {
      el.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.activeTab = t.key;
      state.activeThemes = new Set();
      renderThemeFilters();
      renderIssues();
    });
    el.appendChild(b);
  });
}

function renderThemeFilters() {
  const el = document.getElementById('theme-filters');
  const kind = state.activeTab;

  if (kind === 'eco') {
    const counts = state.aggregated.themeCounts;
    const totalCount = Object.values(counts).reduce((a,b) => a+b, 0);

    let html = `<button class="theme-chip all ${state.activeThemes.size === 0 ? 'active' : ''}" data-theme="__all">
      Toutes <span class="chip-count">${totalCount}</span>
    </button>`;

    for (const theme of RGESN_THEMES) {
      const n = counts[theme] || 0;
      const active = state.activeThemes.has(theme) ? 'active' : '';
      const empty = n === 0 ? 'empty' : '';
      html += `<button class="theme-chip ${active} ${empty}" data-theme="${escapeHtml(theme)}" ${n === 0 ? 'disabled' : ''}>
        ${escapeHtml(theme)} <span class="chip-count">${n}</span>
      </button>`;
    }
    el.innerHTML = html;
    el.style.display = 'flex';
  } else if (kind === 'a11y') {
    const counts = {};
    for (const { rule } of state.aggregated.byRule.a11y.values()) {
      counts[rule.famille] = (counts[rule.famille] || 0) + 1;
    }
    const families = Object.keys(counts).sort();
    const total = Object.values(counts).reduce((a,b)=>a+b,0);

    let html = `<button class="theme-chip all ${state.activeThemes.size === 0 ? 'active' : ''}" data-theme="__all">
      Toutes <span class="chip-count">${total}</span>
    </button>`;
    for (const f of families) {
      const active = state.activeThemes.has(f) ? 'active' : '';
      html += `<button class="theme-chip ${active}" data-theme="${escapeHtml(f)}">
        ${escapeHtml(f)} <span class="chip-count">${counts[f]}</span>
      </button>`;
    }
    el.innerHTML = html;
    el.style.display = 'flex';
  }

  el.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const theme = chip.dataset.theme;
      if (theme === '__all') state.activeThemes.clear();
      else {
        if (state.activeThemes.has(theme)) state.activeThemes.delete(theme);
        else state.activeThemes.add(theme);
      }
      renderThemeFilters();
      renderIssues();
    });
  });
}

function renderIssues() {
  const el = document.getElementById('issues');
  const kind = state.activeTab;
  const ruleMap = state.aggregated.byRule[kind];

  const themeKey = kind === 'eco' ? 'thematique' : 'famille';
  const entries = [...ruleMap.values()].filter(e =>
    state.activeThemes.size === 0 || state.activeThemes.has(e.rule[themeKey])
  );

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🎉</span>Aucun problème dans ce filtre.</div>`;
    return;
  }

  if (state.view === 'rule') {
    renderByRule(el, entries, kind);
  } else {
    renderByPage(el, entries, kind);
  }

  bindSampleButtons(el);
  bindIssueToggles(el);
}

function renderByRule(el, entries, kind) {
  const order = { critique: 0, majeur: 1, mineur: 2 };
  entries.sort((a, b) => (order[a.rule.severity] ?? 3) - (order[b.rule.severity] ?? 3));

  el.innerHTML = entries.map(entry => {
    const r = entry.rule;
    const meta = kind === 'a11y'
      ? `RGAA ${r.rgaa} · Niveau ${r.level} · ${r.famille}`
      : `RGESN ${r.critere} · ${r.thematique}`;
    const measure = r.measure ? `<div class="issue-measure">📊 ${escapeHtml(r.measure)}</div>` : '';

    const pagesHtml = entry.byPage.map(p => `
      <div class="rule-page-item">
        <span class="url">${escapeHtml(p.url)}</span>
        <div class="samples-list">
          ${renderSamples(p.samples, p.url)}
        </div>
      </div>
    `).join('');

    const pagesBlock = state.pagesResults.length > 1
      ? `<div class="rule-pages">
           <div class="rule-pages-label">${entry.byPage.length} page(s) impactée(s) · ${entry.totalCount} occurrence(s)</div>
           ${pagesHtml}
         </div>`
      : `<div class="samples-list">${renderSamples(entry.byPage[0]?.samples || [], entry.byPage[0]?.url)}</div>`;

    return `
      <div class="issue ${r.severity}" data-id="${r.id}">
        <div class="issue-header">
          <span class="issue-badge ${r.severity}">${r.severity}</span>
          <div class="issue-title">
            ${escapeHtml(r.title)}
            <div class="issue-meta">${meta}</div>
          </div>
          <span class="issue-count">${entry.totalCount}</span>
          <span class="issue-toggle">▶</span>
        </div>
        <div class="issue-body">
          <div class="issue-advice">💡 ${escapeHtml(r.advice)}</div>
          ${measure}
          ${pagesBlock}
        </div>
      </div>`;
  }).join('');
}

function renderByPage(el, entries, kind) {
  // Group issues by page URL
  const pageMap = new Map();
  for (const entry of entries) {
    for (const p of entry.byPage) {
      if (!pageMap.has(p.url)) pageMap.set(p.url, []);
      pageMap.get(p.url).push({ entry, pageInfo: p });
    }
  }

  const groups = [...pageMap.entries()].map(([url, items]) => ({
    url, items, total: items.reduce((a, x) => a + x.pageInfo.count, 0)
  })).sort((a, b) => b.total - a.total);

  el.innerHTML = groups.map(g => `
    <div class="page-group">
      <div class="page-group-header">
        <span class="toggle">▶</span>
        <span class="page-url">${escapeHtml(g.url)}</span>
        <span class="page-count">${g.total}</span>
      </div>
      <div class="page-group-body">
        ${g.items.map(({ entry, pageInfo }) => {
          const r = entry.rule;
          const meta = kind === 'a11y'
            ? `RGAA ${r.rgaa} · ${r.famille}`
            : `RGESN ${r.critere} · ${r.thematique}`;
          return `
            <div class="issue ${r.severity}">
              <div class="issue-header">
                <span class="issue-badge ${r.severity}">${r.severity}</span>
                <div class="issue-title">${escapeHtml(r.title)}
                  <div class="issue-meta">${meta}</div>
                </div>
                <span class="issue-count">${pageInfo.count}</span>
                <span class="issue-toggle">▶</span>
              </div>
              <div class="issue-body">
                <div class="issue-advice">💡 ${escapeHtml(r.advice)}</div>
                <div class="samples-list">${renderSamples(pageInfo.samples, g.url)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.page-group-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('expanded'));
  });
}

function renderSamples(samples, pageUrl) {
  if (!samples || !samples.length) return '';
  return samples.map(s => {
    const anchorable = !!s.auditId;
    return `<button class="sample-btn" ${anchorable ? '' : 'disabled'}
      data-audit-id="${escapeHtml(s.auditId || '')}"
      data-page-url="${escapeHtml(pageUrl || '')}">
      <span class="sample-code">${escapeHtml(s.outer || s.selector)}</span>
      ${anchorable ? '<span class="jump-icon">↗</span>' : ''}
    </button>`;
  }).join('');
}

function bindIssueToggles(el) {
  el.querySelectorAll('.issue-header').forEach(h => {
    if (h.__nrBound) return;
    h.__nrBound = true;
    h.addEventListener('click', (ev) => {
      if (ev.target.closest('.sample-btn')) return;
      h.parentElement.classList.toggle('expanded');
    });
  });
}

function bindSampleButtons(el) {
  el.querySelectorAll('.sample-btn').forEach(btn => {
    if (btn.__nrBound || btn.disabled) return;
    btn.__nrBound = true;
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await jumpToElement(btn.dataset.pageUrl, btn.dataset.auditId);
    });
  });
}

// ---------------- Jump-to-element ----------------
async function jumpToElement(pageUrl, auditId) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tab.id;
    let needsRemark = false;

    const currentUrl = normalizeUrl(tab.url || '');
    if (normalizeUrl(pageUrl) !== currentUrl) {
      await chrome.tabs.update(tabId, { url: pageUrl, active: true });
      await waitForTabLoad(tabId);
      needsRemark = true;
    } else {
      await chrome.tabs.update(tabId, { active: true });
      // Si l'audit a été fait dans un autre onglet (site-wide), il faut re-marquer ici
      const [check] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (id) => !!document.querySelector(`[data-nr-audit-id="${CSS.escape(id)}"]`),
        args: [auditId]
      });
      if (!check?.result) needsRemark = true;
    }

    if (needsRemark) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['audit.js'] });
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (m) => globalThis.__nrAudit(m),
        args: [state.mode]
      });
    }

    await chrome.scripting.executeScript({ target: { tabId }, files: ['highlight.js'] });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => globalThis.__nrHighlight(id),
      args: [auditId]
    });
  } catch (e) {
    console.error('jumpToElement failed', e);
  }
}

// ---------------- Export CSV ----------------
function currentFilteredEntries() {
  const out = [];
  for (const kind of ['a11y', 'eco']) {
    if (!state.aggregated.byRule[kind]) continue;
    const themeKey = kind === 'eco' ? 'thematique' : 'famille';
    for (const entry of state.aggregated.byRule[kind].values()) {
      if (state.activeTab !== kind && state.mode !== 'both') continue;
      if (state.activeThemes.size && !state.activeThemes.has(entry.rule[themeKey])) continue;
      out.push({ kind, entry });
    }
  }
  return out;
}

function exportCsv() {
  const rows = [['page_url','type','thematique_ou_famille','severite','regle_id','titre','rgaa_ou_rgesn','occurrences','mesure','conseil']];

  for (const kind of ['a11y', 'eco']) {
    if (!state.aggregated.byRule[kind]) continue;
    for (const entry of state.aggregated.byRule[kind].values()) {
      const r = entry.rule;
      const themeKey = kind === 'eco' ? 'thematique' : 'famille';
      if (state.activeThemes.size && !state.activeThemes.has(r[themeKey])) continue;
      const ref = kind === 'a11y' ? `RGAA ${r.rgaa} / ${r.level}` : `RGESN ${r.critere}`;
      for (const p of entry.byPage) {
        rows.push([
          p.url, kind === 'a11y' ? 'Accessibilité' : 'Écoconception',
          r[themeKey] || '', r.severity, r.id, r.title, ref,
          String(p.count), r.measure || '', r.advice
        ]);
      }
    }
  }

  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const domain = state.pagesResults[0] ? new URL(state.pagesResults[0].meta.url).hostname : 'audit';
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `audit-${domain}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------- Export PDF ----------------
function exportPdf() {
  const domain = state.pagesResults[0] ? new URL(state.pagesResults[0].meta.url).hostname : 'audit';
  const date = new Date().toLocaleString('fr-FR');
  const title = state.mode === 'a11y' ? 'Accessibilité' : state.mode === 'eco' ? 'Écoconception' : 'Complet';

  let html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Rapport ${title} — ${domain}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a2332; max-width: 900px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #2d7a4f; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  .meta { color: #6b7a8f; font-size: 12px; margin-bottom: 24px; }
  .score { display: inline-block; padding: 16px 28px; background: #f7f9fb; border-radius: 10px; margin-right: 12px; text-align: center; }
  .score .num { font-size: 32px; font-weight: 700; display: block; }
  .score .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7a8f; }
  .issue { break-inside: avoid; margin-bottom: 14px; padding: 12px; border-left: 3px solid #ccc; background: #f7f9fb; border-radius: 4px; }
  .issue.critique { border-left-color: #c13535; }
  .issue.majeur { border-left-color: #d97706; }
  .issue.mineur { border-left-color: #6b7a8f; }
  .badge { display: inline-block; font-size: 10px; text-transform: uppercase; font-weight: 700; padding: 2px 7px; border-radius: 3px; margin-right: 6px; }
  .badge.critique { background: #fdecec; color: #c13535; }
  .badge.majeur { background: #fef4e3; color: #d97706; }
  .badge.mineur { background: #eef1f5; color: #6b7a8f; }
  .rule-title { font-weight: 600; font-size: 14px; }
  .rule-meta { color: #6b7a8f; font-size: 11px; margin: 2px 0 8px; }
  .advice { font-size: 13px; margin: 4px 0; }
  .pages-list { font-size: 11px; color: #6b7a8f; margin-top: 6px; padding-left: 16px; }
  .pages-list li { font-family: ui-monospace, Menlo, monospace; word-break: break-all; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e8ee; font-size: 11px; color: #6b7a8f; text-align: center; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>🌿 Rapport d'audit — ${title}</h1>
<p class="meta">Site : <strong>${escapeHtml(domain)}</strong> · ${state.pagesResults.length} page(s) auditée(s) · Généré le ${escapeHtml(date)}</p>`;

  if (state.mode === 'a11y' || state.mode === 'both') {
    html += `<div class="score"><span class="num">${state.aggregated.scores.a11y}</span><span class="label">Accessibilité</span></div>`;
  }
  if (state.mode === 'eco' || state.mode === 'both') {
    html += `<div class="score"><span class="num">${state.aggregated.scores.eco}</span><span class="label">Écoconception</span></div>`;
  }

  const renderSection = (kind, label) => {
    const map = state.aggregated.byRule[kind];
    if (!map || map.size === 0) return;
    const themeKey = kind === 'eco' ? 'thematique' : 'famille';
    const entries = [...map.values()].filter(e => !state.activeThemes.size || state.activeThemes.has(e.rule[themeKey]));
    if (!entries.length) return;

    html += `<h2>${label}</h2>`;
    const order = { critique: 0, majeur: 1, mineur: 2 };
    entries.sort((a, b) => (order[a.rule.severity] ?? 3) - (order[b.rule.severity] ?? 3));

    for (const entry of entries) {
      const r = entry.rule;
      const meta = kind === 'a11y'
        ? `RGAA ${r.rgaa} · Niveau ${r.level} · ${r.famille}`
        : `RGESN ${r.critere} · ${r.thematique}`;
      html += `<div class="issue ${r.severity}">
        <span class="badge ${r.severity}">${r.severity}</span>
        <span class="rule-title">${escapeHtml(r.title)}</span>
        <div class="rule-meta">${meta} · ${entry.totalCount} occurrence(s) sur ${entry.byPage.length} page(s)</div>
        <div class="advice"><strong>Conseil :</strong> ${escapeHtml(r.advice)}</div>
        ${r.measure ? `<div class="advice"><strong>Mesure :</strong> ${escapeHtml(r.measure)}</div>` : ''}
        <ul class="pages-list">${entry.byPage.map(p => `<li>${escapeHtml(p.url)} — ${p.count} occ.</li>`).join('')}</ul>
      </div>`;
    }
  };

  if (state.mode === 'a11y' || state.mode === 'both') renderSection('a11y', 'Accessibilité');
  if (state.mode === 'eco' || state.mode === 'both') renderSection('eco', 'Écoconception');

  html += `<footer>Rapport généré par l'extension Numérique Responsable</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));<\/script>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ---------------- Saved audits (chrome.storage.local) ----------------
const STORAGE_KEY = 'nrSavedAudits';

async function getSavedAudits() {
  try {
    const { [STORAGE_KEY]: list } = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('[NR] getSavedAudits failed:', e);
    return [];
  }
}

async function setSavedAudits(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

// One-shot : récupère les audits encore présents dans l'ancien localStorage
// (volatile dans un side panel MV3) et les bascule vers chrome.storage.local.
async function migrateLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      const existing = await getSavedAudits();
      if (!existing.length) await setSavedAudits(parsed);
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Réduit la taille d'un audit avant stockage : on retire les outerHTML
// (~200 c/sample) et on plafonne le nombre d'échantillons par règle.
// Les pages ont la forme { a11y: [...], eco: [...], meta: {...} }.
function slimIssues(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(issue => ({
    ...issue,
    samples: Array.isArray(issue.samples)
      ? issue.samples.slice(0, 3).map(s => ({ auditId: s.auditId, selector: s.selector }))
      : issue.samples
  }));
}
function slimPagesResults(pagesResults) {
  return pagesResults.map(page => ({
    ...page,
    a11y: slimIssues(page.a11y),
    eco: slimIssues(page.eco)
  }));
}

async function saveCurrentAudit() {
  if (!state.pagesResults.length) return;
  const hostname = new URL(state.pagesResults[0].meta.url).hostname;
  const defaultName = `${hostname} — ${new Date().toLocaleString('fr-FR')}`;
  const name = await nrPrompt("Nom de l'audit :", defaultName);
  if (name === null) return;

  const entry = {
    id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name: name.trim() || defaultName,
    date: new Date().toISOString(),
    hostname,
    mode: state.mode,
    scope: state.scope,
    pageLimit: state.pageLimit,
    pagesResults: slimPagesResults(state.pagesResults),
    auditedCount: state.auditedCount,
    attemptedCount: state.attemptedCount,
    failedUrls: state.failedUrls
  };

  const list = await getSavedAudits();
  list.unshift(entry);
  try {
    await setSavedAudits(list);
  } catch (err) {
    console.error('[NR] Save failed:', err);
    nrToast('Sauvegarde impossible : ' + err.message, { tone: 'error', duration: 4000 });
    return;
  }
  await refreshSavedList();
  nrToast('✓ Audit sauvegardé dans Mes audits');

  // Bascule vers l'accueil, onglet "Mes audits", et met en évidence la
  // nouvelle entrée pour montrer clairement où l'audit est rangé.
  activatePanel('saved');
  show('select');
  requestAnimationFrame(() => {
    const justSaved = document.querySelector(`.saved-item[data-id="${entry.id}"]`);
    if (justSaved) {
      justSaved.classList.add('highlight-new');
      justSaved.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => justSaved.classList.remove('highlight-new'), 1800);
    }
  });
}

async function refreshSavedList() {
  const list = await getSavedAudits();
  const ul = document.getElementById('saved-audits-list');
  const empty = document.getElementById('saved-empty');
  const badge = document.getElementById('saved-count');

  if (badge) {
    badge.textContent = list.length;
    badge.style.display = list.length ? 'inline-flex' : 'none';
  }

  if (!list.length) {
    if (empty) empty.style.display = 'block';
    ul.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  ul.innerHTML = list.map(a => {
    const modeLabel = a.mode === 'a11y' ? 'A11y' : a.mode === 'eco' ? 'Eco' : 'Complet';
    const date = new Date(a.date).toLocaleDateString('fr-FR') + ' ' + new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <li class="saved-item" data-id="${escapeHtml(a.id)}">
        <div class="saved-item-main" data-id="${escapeHtml(a.id)}">
          <span class="saved-item-name">${escapeHtml(a.name)}</span>
          <span class="saved-item-meta">${escapeHtml(a.hostname)} · ${modeLabel} · ${a.pagesResults.length} page(s) · ${date}</span>
        </div>
        <button class="saved-item-rename" data-id="${escapeHtml(a.id)}" title="Renommer" aria-label="Renommer">✏️</button>
        <button class="saved-item-delete" data-id="${escapeHtml(a.id)}" title="Supprimer" aria-label="Supprimer">🗑</button>
      </li>`;
  }).join('');

  ul.querySelectorAll('.saved-item-main').forEach(el =>
    el.addEventListener('click', () => loadSavedAudit(el.dataset.id))
  );
  ul.querySelectorAll('.saved-item-rename').forEach(el =>
    el.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await renameSavedAudit(el.dataset.id);
    })
  );
  ul.querySelectorAll('.saved-item-delete').forEach(el =>
    el.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const name = el.closest('.saved-item').querySelector('.saved-item-name').textContent;
      if (!(await nrConfirm(`Supprimer l'audit "${name}" ?`))) return;
      await deleteSavedAudit(el.dataset.id);
    })
  );
}

async function renameSavedAudit(id) {
  const list = await getSavedAudits();
  const entry = list.find(a => a.id === id);
  if (!entry) return;
  const newName = await nrPrompt('Nouveau nom :', entry.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === entry.name) return;
  entry.name = trimmed;
  await setSavedAudits(list);
  refreshSavedList();
}

async function loadSavedAudit(id) {
  const list = await getSavedAudits();
  const entry = list.find(a => a.id === id);
  if (!entry) return;

  state.mode = entry.mode;
  state.scope = entry.scope || 'site';
  state.pageLimit = entry.pageLimit ?? 'all';
  state.pagesResults = entry.pagesResults;
  state.auditedCount = entry.auditedCount || entry.pagesResults.length;
  state.attemptedCount = entry.attemptedCount || entry.pagesResults.length;
  state.failedUrls = entry.failedUrls || [];
  state.activeThemes = new Set();
  state.view = 'rule';

  state.aggregated = aggregateResults(state.pagesResults, state.mode);
  renderResults();
  show('results');
}

async function deleteSavedAudit(id) {
  const list = await getSavedAudits();
  await setSavedAudits(list.filter(a => a.id !== id));
  refreshSavedList();
}

// ---------------- Utils ----------------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
