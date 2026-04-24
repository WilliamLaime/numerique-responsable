chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let detachedWindowId = null;

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === detachedWindowId) detachedWindowId = null;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'detach-window') {
    if (detachedWindowId !== null) {
      chrome.windows.update(detachedWindowId, { focused: true, state: 'normal' })
        .catch(() => {
          detachedWindowId = null;
          createDetachedWindow();
        });
    } else {
      createDetachedWindow();
    }
    sendResponse({ ok: true });
  }
  return true;
});

function createDetachedWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html?mode=window'),
    type: 'popup',
    width: 440,
    height: 760,
    focused: true,
  }).then((win) => {
    detachedWindowId = win.id;
  });
}
