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
const RGAA_THEMES_ORDER = [
  'Images', 'Cadres', 'Couleurs', 'Multimédia', 'Tableaux',
  'Liens', 'Scripts', 'Éléments obligatoires', 'Structuration',
  'Présentation', 'Formulaires', 'Navigation', 'Consultation'
];
const STATUS_ORDER = ['NC', 'C', 'NA'];
const STATUS_LABEL = {
  C: 'Conforme', NC: 'Non conforme', NA: 'Non applicable'
};

const MAX_PAGES_HARD_CAP = 500;
const PAGES_CONFIRM_THRESHOLD = 100;

const state = {
  mode: null,
  scope: 'site',
  pageLimit: 'all',
  pagesResults: [],
  aggregated: null,
  view: 'theme',
  activeThemes: new Set(),
  activeStatuses: new Set(['NC']),  // Par défaut, on met l'accent sur ce qui réclame de l'attention
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
    renderThemeFilters();
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
  state.activeStatuses = new Set(['NC']);
  state.view = 'theme';
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
// Une règle s'exécute sur N pages. On garde le pire statut par règle pour
// l'affichage (NC > NT > C > NA). Les samples et counts sont aggregés.
const STATUS_PRIORITY = { NC: 3, NT: 2, C: 1, NA: 0 };

function worseStatus(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (STATUS_PRIORITY[a] ?? -1) >= (STATUS_PRIORITY[b] ?? -1) ? a : b;
}

function themeKeyOf(kind, rule) {
  return kind === 'a11y' ? (rule.themeLabel || '') : (rule.thematique || '');
}

function aggregateResults(pages, mode) {
  const byRule = { a11y: new Map(), eco: new Map() };
  for (const page of pages) {
    for (const kind of ['a11y', 'eco']) {
      if (!page[kind]) continue;
      for (const issue of page[kind]) {
        const entry = byRule[kind].get(issue.id) || {
          rule: issue,
          totalCount: 0,
          aggregateStatus: null,
          byPage: []
        };
        entry.totalCount += (issue.count || 0);
        entry.aggregateStatus = worseStatus(entry.aggregateStatus, issue.status);
        entry.byPage.push({
          url: page.meta.url,
          count: issue.count || 0,
          status: issue.status,
          measure: issue.measure || '',
          samples: issue.samples || [],
          details: issue.details || [],
          manualPrompt: issue.manualPrompt || null
        });
        byRule[kind].set(issue.id, entry);
      }
    }
  }

  return {
    byRule,
    pages,
    scores: {
      a11y: computeScore(byRule.a11y),
      eco: computeScore(byRule.eco)
    },
    statusCounts: {
      a11y: countStatuses(byRule.a11y),
      eco: countStatuses(byRule.eco)
    },
    themeStats: {
      a11y: groupByTheme('a11y', byRule.a11y),
      eco: groupByTheme('eco', byRule.eco)
    }
  };
}

// Score Tanaguru-like : % de C sur l'ensemble C+NC (NA et NT exclus).
// Les NT sont comptés comme « non jugés » et n'impactent pas le score.
function computeScore(ruleMap) {
  let c = 0, nc = 0;
  for (const { aggregateStatus } of ruleMap.values()) {
    if (aggregateStatus === 'C') c++;
    else if (aggregateStatus === 'NC') nc++;
  }
  const denom = c + nc;
  if (!denom) return 100;
  return Math.round((c / denom) * 100);
}

function countStatuses(ruleMap) {
  const counts = { C: 0, NC: 0, NA: 0, NT: 0 };
  for (const { aggregateStatus } of ruleMap.values()) {
    if (counts[aggregateStatus] !== undefined) counts[aggregateStatus]++;
  }
  return counts;
}

function groupByTheme(kind, ruleMap) {
  const order = kind === 'a11y' ? RGAA_THEMES_ORDER : RGESN_THEMES;
  const themes = new Map(order.map(t => [t, { theme: t, C: 0, NC: 0, NA: 0, NT: 0, total: 0, rules: [] }]));
  for (const entry of ruleMap.values()) {
    const key = themeKeyOf(kind, entry.rule);
    if (!key) continue;
    if (!themes.has(key)) themes.set(key, { theme: key, C: 0, NC: 0, NA: 0, NT: 0, total: 0, rules: [] });
    const bucket = themes.get(key);
    if (bucket[entry.aggregateStatus] !== undefined) bucket[entry.aggregateStatus]++;
    bucket.total++;
    bucket.rules.push(entry);
  }
  return themes;
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

  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === state.view);
  });

  renderScores();
  renderTabs();
  renderStatusFilters();
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

  const breakdown = (kind) => {
    const s = state.aggregated.statusCounts[kind];
    return `<div class="breakdown status-breakdown">
      <span class="status-pill C" title="Conforme">✓ ${s.C}</span>
      <span class="status-pill NC" title="Non conforme">✗ ${s.NC}</span>
      <span class="status-pill NA" title="Non applicable">− ${s.NA}</span>
    </div>`;
  };

  let html = '';
  if (mode === 'a11y' || mode === 'both') {
    html += `
      <div class="score-card">
        <div class="label">Accessibilité</div>
        ${ring(state.aggregated.scores.a11y)}
        ${breakdown('a11y')}
      </div>`;
  }
  if (mode === 'eco' || mode === 'both') {
    html += `
      <div class="score-card">
        <div class="label">Écoconception</div>
        ${ring(state.aggregated.scores.eco)}
        ${breakdown('eco')}
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
      renderStatusFilters();
      renderThemeFilters();
      renderIssues();
    });
    el.appendChild(b);
  });
}

function renderStatusFilters() {
  const el = document.getElementById('status-filters');
  const kind = state.activeTab;
  const counts = state.aggregated.statusCounts[kind];

  const chip = (code, label, title) => {
    const active = state.activeStatuses.has(code) ? 'active' : '';
    const n = counts[code] || 0;
    return `<button class="status-chip ${code} ${active}" data-status="${code}" title="${escapeHtml(title)}">
      ${label} <span class="chip-count">${n}</span>
    </button>`;
  };

  el.innerHTML = `
    ${chip('NC', '✗ Non conforme', 'Critères en échec')}
    ${chip('C',  '✓ Conforme',    'Critères validés automatiquement')}
    ${chip('NA', '− Non applicable', 'Critères sans objet sur la page')}
  `;
  el.style.display = 'flex';

  el.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.status;
      if (state.activeStatuses.has(s)) state.activeStatuses.delete(s);
      else state.activeStatuses.add(s);
      // Éviter filtre vide (rien ne passerait) : rétablir tout si set vide
      if (!state.activeStatuses.size) state.activeStatuses = new Set(['C', 'NC', 'NA']);
      renderStatusFilters();
      renderIssues();
    });
  });
}

function renderThemeFilters() {
  const el = document.getElementById('theme-filters');
  const kind = state.activeTab;
  // Vue « Par thématique » : pas de filtre thème (la vue elle-même groupe)
  if (state.view === 'theme') {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }

  const themeMap = state.aggregated.themeStats[kind];
  const themes = [...themeMap.entries()].filter(([, v]) => v.total > 0);
  const total = themes.reduce((a, [, v]) => a + v.total, 0);

  let html = `<button class="theme-chip all ${state.activeThemes.size === 0 ? 'active' : ''}" data-theme="__all">
    Toutes <span class="chip-count">${total}</span>
  </button>`;
  for (const [name, v] of themes) {
    const active = state.activeThemes.has(name) ? 'active' : '';
    html += `<button class="theme-chip ${active}" data-theme="${escapeHtml(name)}">
      ${escapeHtml(name)} <span class="chip-count">${v.total}</span>
    </button>`;
  }
  el.innerHTML = html;
  el.style.display = 'flex';

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

function entryPasses(entry, kind) {
  // Filtre statut
  if (!state.activeStatuses.has(entry.aggregateStatus)) return false;
  // Filtre thématique (vue Par règle / Par page uniquement)
  if (state.view !== 'theme' && state.activeThemes.size) {
    const key = themeKeyOf(kind, entry.rule);
    if (!state.activeThemes.has(key)) return false;
  }
  return true;
}

function renderIssues() {
  const el = document.getElementById('issues');
  const kind = state.activeTab;
  const ruleMap = state.aggregated.byRule[kind];
  const entries = [...ruleMap.values()].filter(e => entryPasses(e, kind));

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🎉</span>Aucun critère dans ce filtre.</div>`;
    return;
  }

  if (state.view === 'theme')       renderByTheme(el, entries, kind);
  else if (state.view === 'rule')   renderByRule(el, entries, kind);
  else                              renderByPage(el, entries, kind);

  bindSampleButtons(el);
  bindIssueToggles(el);
}

function ruleMeta(kind, r) {
  return kind === 'a11y'
    ? `RGAA ${r.rgaa} · Niveau ${r.level} · ${r.themeLabel || ''}`
    : `RGESN ${r.critere || ''} · ${r.thematique || ''}`;
}

function statusBadge(status) {
  return `<span class="issue-badge status-${status}" title="${escapeHtml(STATUS_LABEL[status] || status)}">${status}</span>`;
}

function severityBadge(severity) {
  if (!severity) return '';
  return `<span class="issue-badge sev-${severity}">${severity}</span>`;
}

function renderOneIssueCard(entry, kind, pageInfo) {
  // pageInfo optionnel : si fourni, on affiche les infos d'une page spécifique
  // (utilisé pour la vue « par page »). Sinon, on agrège sur toutes les pages.
  const r = entry.rule;
  const status = pageInfo ? pageInfo.status : entry.aggregateStatus;
  const meta = ruleMeta(kind, r);
  const measure = pageInfo ? pageInfo.measure : (entry.byPage.find(p => p.measure)?.measure || '');
  const measureHtml = measure ? `<div class="issue-measure">📊 ${escapeHtml(measure)}</div>` : '';

  const manualPrompt = pageInfo
    ? pageInfo.manualPrompt
    : entry.byPage.find(p => p.manualPrompt)?.manualPrompt;
  const promptHtml = manualPrompt && status === 'NT'
    ? `<div class="issue-manual">❓ ${escapeHtml(manualPrompt)}</div>`
    : '';

  const details = pageInfo ? pageInfo.details : (entry.byPage[0]?.details || []);
  const detailsHtml = details?.length
    ? `<details class="issue-details-toggle"><summary>Détails (${details.length})</summary><ul class="issue-details">${details.map(d => `<li><span class="detail-label">${escapeHtml(d.label)}</span><span class="detail-value">${escapeHtml(d.value)}</span></li>`).join('')}</ul></details>`
    : '';

  const samples = pageInfo ? pageInfo.samples : null;
  let pagesBlock = '';
  if (pageInfo) {
    pagesBlock = `<div class="samples-list">${renderSamples(samples, pageInfo.url)}</div>`;
  } else if (entry.byPage.length > 1) {
    const pagesHtml = entry.byPage.map(p => `
      <div class="rule-page-item">
        <span class="url">${escapeHtml(p.url)} <span class="mini-badge status-${p.status}">${p.status}</span></span>
        ${p.samples?.length ? `<div class="samples-list">${renderSamples(p.samples, p.url)}</div>` : ''}
      </div>
    `).join('');
    pagesBlock = `<div class="rule-pages">
      <div class="rule-pages-label">${entry.byPage.length} page(s) · ${entry.totalCount} occurrence(s)</div>
      ${pagesHtml}
    </div>`;
  } else {
    const only = entry.byPage[0];
    pagesBlock = only?.samples?.length
      ? `<div class="samples-list">${renderSamples(only.samples, only.url)}</div>`
      : '';
  }

  const sev = kind === 'eco' ? r.severity : null;
  const count = pageInfo ? pageInfo.count : entry.totalCount;
  const countHtml = count > 0 ? `<span class="issue-count">${count}</span>` : '';
  const rgaaLink = kind === 'a11y' && r.rgaa
    ? ` <a class="issue-ref-link" target="_blank" rel="noopener" href="https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${encodeURIComponent(r.rgaa)}" title="Voir le critère sur accessibilite.numerique.gouv.fr">↗</a>`
    : '';

  return `
    <div class="issue status-${status}" data-id="${escapeHtml(r.id)}">
      <div class="issue-header">
        ${statusBadge(status)}
        ${severityBadge(sev)}
        <div class="issue-title">
          ${escapeHtml(r.title)}${rgaaLink}
          <div class="issue-meta">${escapeHtml(meta)}</div>
        </div>
        ${countHtml}
        <span class="issue-toggle">▶</span>
      </div>
      <div class="issue-body">
        ${r.advice ? `<div class="issue-advice">💡 ${escapeHtml(r.advice)}</div>` : ''}
        ${promptHtml}
        ${measureHtml}
        ${detailsHtml}
        ${pagesBlock}
      </div>
    </div>`;
}

function sortEntries(entries) {
  // NC en premier, puis NT, puis C, puis NA ; critères RGAA dans l'ordre naturel
  entries.sort((a, b) => {
    const sp = (STATUS_PRIORITY[b.aggregateStatus] ?? -1) - (STATUS_PRIORITY[a.aggregateStatus] ?? -1);
    if (sp) return sp;
    const na = a.rule.rgaa || a.rule.critere || '';
    const nb = b.rule.rgaa || b.rule.critere || '';
    return na.localeCompare(nb, undefined, { numeric: true });
  });
  return entries;
}

function renderByRule(el, entries, kind) {
  sortEntries(entries);
  el.innerHTML = entries.map(entry => renderOneIssueCard(entry, kind)).join('');
}

function renderByTheme(el, entries, kind) {
  const themeMap = state.aggregated.themeStats[kind];
  const order = kind === 'a11y' ? RGAA_THEMES_ORDER : RGESN_THEMES;
  const entriesIds = new Set(entries.map(e => e.rule.id));

  const sections = order
    .map(name => themeMap.get(name))
    .filter(v => v && v.total > 0)
    .map(theme => {
      const filtered = theme.rules.filter(e => entriesIds.has(e.rule.id));
      if (!filtered.length) return null;
      sortEntries(filtered);
      const rulesHtml = filtered.map(e => renderOneIssueCard(e, kind)).join('');
      const dist = `
        <span class="theme-stat C" title="Conforme">✓ ${theme.C}</span>
        <span class="theme-stat NC" title="Non conforme">✗ ${theme.NC}</span>
        <span class="theme-stat NA" title="Non applicable">− ${theme.NA}</span>`;
      return `
        <div class="theme-section expanded">
          <div class="theme-section-header">
            <span class="toggle">▼</span>
            <span class="theme-section-title">${escapeHtml(theme.theme)}</span>
            <span class="theme-section-dist">${dist}</span>
          </div>
          <div class="theme-section-body">${rulesHtml}</div>
        </div>`;
    })
    .filter(Boolean);

  el.innerHTML = sections.join('') || `<div class="empty-state"><span class="emoji">🎉</span>Aucun critère dans ce filtre.</div>`;

  el.querySelectorAll('.theme-section-header').forEach(h => {
    h.addEventListener('click', (ev) => {
      if (ev.target.closest('.issue')) return;
      h.parentElement.classList.toggle('expanded');
      const tog = h.querySelector('.toggle');
      if (tog) tog.textContent = h.parentElement.classList.contains('expanded') ? '▼' : '▶';
    });
  });
}

function renderByPage(el, entries, kind) {
  const pageMap = new Map();
  for (const entry of entries) {
    for (const p of entry.byPage) {
      if (!state.activeStatuses.has(p.status)) continue;
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
        ${g.items.map(({ entry, pageInfo }) => renderOneIssueCard(entry, kind, pageInfo)).join('')}
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
      if (ev.target.closest('.issue-details-toggle')) return;
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
function exportCsv() {
  const rows = [[
    'page_url', 'type', 'thematique', 'statut',
    'regle_id', 'critere', 'niveau', 'titre',
    'severite_eco', 'occurrences', 'mesure', 'conseil', 'question_manuelle'
  ]];

  for (const kind of ['a11y', 'eco']) {
    if (!state.aggregated.byRule[kind]) continue;
    for (const entry of state.aggregated.byRule[kind].values()) {
      const r = entry.rule;
      const theme = themeKeyOf(kind, r);
      if (state.activeThemes.size && !state.activeThemes.has(theme)) continue;
      for (const p of entry.byPage) {
        if (!state.activeStatuses.has(p.status)) continue;
        rows.push([
          p.url,
          kind === 'a11y' ? 'Accessibilité' : 'Écoconception',
          theme,
          p.status,
          r.id,
          kind === 'a11y' ? (r.rgaa || '') : (r.critere || ''),
          kind === 'a11y' ? (r.level || '') : '',
          r.title || '',
          kind === 'eco' ? (r.severity || '') : '',
          String(p.count || 0),
          p.measure || r.measure || '',
          r.advice || '',
          p.manualPrompt || ''
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
  const { jsPDF } = window.jspdf;
  const domain = state.pagesResults[0] ? new URL(state.pagesResults[0].meta.url).hostname : 'audit';
  const date = new Date().toLocaleString('fr-FR');
  const title = state.mode === 'a11y' ? 'Accessibilité' : state.mode === 'eco' ? 'Écoconception' : 'Complet';

  const btn = document.getElementById('export-pdf');
  btn.disabled = true;
  btn.querySelector('.btn-label').textContent = 'En cours…';

  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210, pageH = 297, margin = 14, contentW = pageW - margin * 2;
    let y = margin;

    const addPageIfNeeded = (h) => {
      if (y + h > pageH - 20) { doc.addPage(); y = margin; }
    };

    const statusColors = {
      NC: { bg: [253, 236, 236], border: [193, 53, 53], text: [193, 53, 53] },
      NT: { bg: [254, 244, 227], border: [217, 119, 6], text: [217, 119, 6] },
      C:  { bg: [230, 243, 235], border: [45, 122, 79], text: [45, 122, 79] },
      NA: { bg: [238, 241, 245], border: [107, 122, 143], text: [107, 122, 143] }
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 35, 50);
    doc.text(`Rapport d'audit — ${title}`, margin, y);
    y += 8;

    // Meta
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 122, 143);
    doc.text(`Site : ${domain} · ${state.pagesResults.length} page(s) · Généré le ${date}`, margin, y);
    y += 10;

    // Score blocks
    const renderScore = (kind, label) => {
      const s = state.aggregated.statusCounts[kind];
      const score = state.aggregated.scores[kind];

      doc.setFillColor(247, 249, 251);
      doc.roundedRect(margin, y, 80, 14, 1, 1, 'F');

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 122, 79);
      doc.text(String(score), margin + 4, y + 9);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 122, 143);
      doc.text(label.toUpperCase(), margin + 18, y + 5);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${s.C}C · ${s.NC}NC · ${s.NT}NT · ${s.NA}NA`, margin + 18, y + 10);

      y += 18;
    };

    if (state.mode === 'a11y' || state.mode === 'both') renderScore('a11y', 'Accessibilité');
    if (state.mode === 'eco' || state.mode === 'both') renderScore('eco', 'Écoconception');

    // Synthesis tables
    const renderSynthTable = (kind, label) => {
      const themes = state.aggregated.themeStats[kind];
      const rows = [...themes.values()].filter(v => v.total);
      if (!rows.length) return;

      addPageIfNeeded(20);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 35, 50);
      doc.text(`${label} — synthèse par thématique`, margin, y);
      y += 6;

      doc.autoTable({
        startY: y, margin: { left: margin, right: margin, top: 0, bottom: 0 },
        head: [['Thématique', 'Total', 'C', 'NC', 'NT', 'NA']],
        body: rows.map(v => [v.theme, String(v.total), String(v.C), String(v.NC), String(v.NT), String(v.NA)]),
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [26, 35, 50] },
        headStyles: { fillColor: [247, 249, 251], textColor: [26, 35, 50], fontStyle: 'bold', fontSize: 7 },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 16 }, 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', cellWidth: 14 }, 4: { halign: 'center', cellWidth: 14 }, 5: { halign: 'center', cellWidth: 14 } },
        theme: 'plain', tableLineColor: [228, 232, 238], tableLineWidth: 0.1, didDrawPage: (data) => { }
      });
      y = doc.lastAutoTable.finalY + 10;
    };

    if (state.mode === 'a11y' || state.mode === 'both') renderSynthTable('a11y', 'Accessibilité');
    if (state.mode === 'eco' || state.mode === 'both') renderSynthTable('eco', 'Écoconception');

    // Issue sections
    const renderSection = (kind, label) => {
      const map = state.aggregated.byRule[kind];
      if (!map || !map.size) return;
      const entries = [...map.values()].filter(entry => {
        if (!state.activeStatuses.has(entry.aggregateStatus)) return false;
        if (state.activeThemes.size) {
          const theme = themeKeyOf(kind, entry.rule);
          if (!state.activeThemes.has(theme)) return false;
        }
        return true;
      });
      if (!entries.length) return;
      sortEntries(entries);

      addPageIfNeeded(14);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 35, 50);
      doc.text(`${label} — détail`, margin, y);
      y += 8;

      for (const entry of entries) {
        const r = entry.rule;
        const status = entry.aggregateStatus;
        const colors = statusColors[status] || statusColors.NA;
        const meta = kind === 'a11y'
          ? `RGAA ${r.rgaa || ''} · N${r.level || ''} · ${r.themeLabel || ''}`
          : `RGESN ${r.critere || ''} · ${r.thematique || ''}`;
        const advice = r.advice ? `Conseil : ${r.advice}` : '';
        const measure = entry.byPage.find(p => p.measure)?.measure || r.measure || '';
        const measureTxt = measure ? `Mesure : ${measure}` : '';

        const titleLines = doc.splitTextToSize(r.title || '', contentW - 24);
        const adviceLines = advice ? doc.splitTextToSize(advice, contentW - 6) : [];
        const measureLines = measureTxt ? doc.splitTextToSize(measureTxt, contentW - 6) : [];
        const urlCount = Math.min(entry.byPage.length > 1 ? entry.byPage.length : 0, 12);

        let h = 4 + titleLines.length * 4 + 3 + (adviceLines.length ? adviceLines.length * 3.5 + 1 : 0) + (measureLines.length ? measureLines.length * 3.5 + 1 : 0) + (urlCount ? urlCount * 3.2 : 0) + 4;
        addPageIfNeeded(h);

        doc.setFillColor(...colors.bg);
        doc.roundedRect(margin, y, contentW, h, 0.8, 0.8, 'F');
        doc.setFillColor(...colors.border);
        doc.rect(margin, y, 2.5, h, 'F');

        let cy = y + 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.text);
        doc.text(status, margin + 4, cy);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 50);
        doc.text(titleLines, margin + 8, cy);
        cy += titleLines.length * 4 + 2;

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 122, 143);
        doc.text(`${meta} · ${entry.totalCount} occ. · ${entry.byPage.length} page(s)`, margin + 4, cy);
        cy += 4;

        if (adviceLines.length) {
          doc.setTextColor(26, 35, 50);
          doc.text(adviceLines, margin + 4, cy);
          cy += adviceLines.length * 3.5 + 1;
        }

        if (measureLines.length) {
          doc.setTextColor(26, 35, 50);
          doc.text(measureLines, margin + 4, cy);
          cy += measureLines.length * 3.5 + 1;
        }

        if (urlCount > 0) {
          doc.setFontSize(7);
          doc.setTextColor(107, 122, 143);
          const shown = entry.byPage.slice(0, 12);
          for (const p of shown) {
            doc.text(`• ${p.url} — ${p.status}${p.count ? ` (${p.count})` : ''}`, margin + 5, cy);
            cy += 3.2;
          }
        }

        y += h + 3;
      }
    };

    if (state.mode === 'a11y' || state.mode === 'both') renderSection('a11y', 'Accessibilité');
    if (state.mode === 'eco' || state.mode === 'both') renderSection('eco', 'Écoconception');

    // Add footer to each page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 122, 143);
      doc.text('Rapport généré par l\'extension Numérique Responsable', margin, pageH - 10);
      doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' });
    }

    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `audit-${domain}-${dateSlug}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('Erreur lors de la génération du PDF');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-label').textContent = 'PDF';
  }
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
  state.activeStatuses = new Set(['NC']);
  state.view = 'theme';

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
