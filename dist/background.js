chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'detach-window') {
    chrome.windows.create({
      url: chrome.runtime.getURL('sidepanel.html?mode=window'),
      type: 'popup',
      width: 440,
      height: 760
    });
    sendResponse({ ok: true });
  }
  return true;
});
