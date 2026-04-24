/**
 * Tab order visualization — overlay numbered badges on focusable elements
 * Exposé via globalThis.__nrTabOrder()
 */

globalThis.__nrTabOrder = function () {
  const OVERLAY_ID = '__nr-taborder-overlay';
  const existing = document.getElementById(OVERLAY_ID);

  if (existing) {
    existing.remove();
    return false;
  }

  const focusable = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type=hidden]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'video[controls]',
    'audio[controls]',
    'details > summary'
  ];

  const selector = focusable.join(',');
  const all = [...document.querySelectorAll(selector)];

  if (!all.length) return false;

  const visible = all.filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });

  if (!visible.length) return false;

  visible.sort((a, b) => {
    const tabA = parseInt(a.getAttribute('tabindex')) || 0;
    const tabB = parseInt(b.getAttribute('tabindex')) || 0;
    if (tabA > 0 && tabB > 0) return tabA - tabB;
    if (tabA > 0) return -1;
    if (tabB > 0) return 1;
    return 0;
  });

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
  `;

  visible.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      top: ${rect.top + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
      width: 22px;
      height: 22px;
      background: #2d7a4f;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      pointer-events: none;
    `;
    badge.textContent = String(index + 1);
    overlay.appendChild(badge);
  });

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    background: #2d7a4f;
    color: #ffffff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483648;
    font-weight: bold;
  `;
  closeBtn.textContent = '✕';
  closeBtn.title = 'Fermer l\'affichage de l\'ordre de tabulation';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    overlay.remove();
  };
  closeBtn.onkeydown = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      overlay.remove();
    }
  };
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
  return true;
};
