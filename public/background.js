chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

const STORAGE_KEY = 'detachedWindowId';

async function getDetachedWindowId() {
  try {
    const r = await chrome.storage.session.get(STORAGE_KEY);
    return r[STORAGE_KEY] ?? null;
  } catch { return null; }
}
async function setDetachedWindowId(id) {
  try { await chrome.storage.session.set({ [STORAGE_KEY]: id }); } catch {}
}
async function clearDetachedWindowId() {
  try { await chrome.storage.session.remove(STORAGE_KEY); } catch {}
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const detached = await getDetachedWindowId();
  if (windowId === detached) await clearDetachedWindowId();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'detach-window') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const targetTabId = tab?.id ?? null;
      (async () => {
        const detached = await getDetachedWindowId();
        if (detached !== null) {
          try {
            await chrome.windows.update(detached, { focused: true, state: 'normal' });
          } catch {
            await clearDetachedWindowId();
            await createDetachedWindow(targetTabId);
          }
        } else {
          await createDetachedWindow(targetTabId);
        }
        sendResponse({ ok: true });
      })();
    });
  }
  return true;
});

async function createDetachedWindow(targetTabId) {
  const params = targetTabId != null ? `?mode=window&targetTabId=${targetTabId}` : '?mode=window';
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`sidepanel.html${params}`),
    type: 'popup',
    width: 440,
    height: 760,
    focused: true,
  });
  if (win?.id) await setDetachedWindowId(win.id);
}
