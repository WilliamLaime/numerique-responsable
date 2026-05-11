(function () {
  'use strict';

  let _nrCcCanvas;
  const normalizeColor = (c) => {
    if (!c || c === 'transparent') return 'rgba(0,0,0,0)';
    try {
      if (!_nrCcCanvas) _nrCcCanvas = document.createElement('canvas').getContext('2d');
      _nrCcCanvas.fillStyle = '#000';
      _nrCcCanvas.fillStyle = c;
      return _nrCcCanvas.fillStyle;
    } catch { return null; }
  };
  const parseColor = (c) => {
    const norm = normalizeColor(c);
    if (!norm) return null;
    if (norm === 'rgba(0,0,0,0)') return [0, 0, 0, 0];
    if (norm.startsWith('#')) {
      const hex = norm.slice(1);
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16),
              hex.length === 8 ? parseInt(hex.slice(6,8),16)/255 : 1];
    }
    const m = norm.match(/[\d.]+/g);
    if (!m) return null;
    return [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1];
  };

  const bgChain = (el) => {
    let cur = el;
    const stack = [];
    while (cur) {
      const cs = getComputedStyle(cur);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parseColor(cs.backgroundColor);
      if (c && c[3] > 0) {
        stack.push(c);
        if (c[3] === 1) break;
      }
      if (cur === document.documentElement) break;
      cur = cur.parentElement;
    }
    let r = 255, g = 255, b = 255;
    for (let i = stack.length - 1; i >= 0; i--) {
      const [fr, fg, fb, fa] = stack[i];
      r = r * (1 - fa) + fr * fa;
      g = g * (1 - fa) + fg * fa;
      b = b * (1 - fa) + fb * fa;
    }
    return [r, g, b, 1];
  };

  const luminance = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const contrastRatio = (c1, c2) => {
    const l1 = luminance(c1[0], c1[1], c1[2]);
    const l2 = luminance(c2[0], c2[1], c2[2]);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const toHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  globalThis.__nrContrastCheck = function () {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return { error: 'no-selection' };

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el) return { error: 'no-element' };

    const cs = window.getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) return { error: 'no-color' };

    const bg = bgChain(el);
    const fontSizePx = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const isBold = fontWeight >= 700;
    const isLargeText = fontSizePx >= 24 || (isBold && fontSizePx >= 18.67);

    const text = sel.toString().slice(0, 120);

    if (!bg) {
      return {
        text,
        fg: toHex(fg[0], fg[1], fg[2]),
        bg: null,
        fontSizePx: Math.round(fontSizePx * 10) / 10,
        fontWeight,
        isLargeText,
        ratio: null,
        passAA: null,
        passAAA: null,
        error: 'image-bg',
      };
    }

    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
    const aaThreshold = isLargeText ? 3.0 : 4.5;
    const aaaThreshold = isLargeText ? 4.5 : 7.0;

    return {
      text,
      fg: toHex(fg[0], fg[1], fg[2]),
      bg: toHex(bg[0], bg[1], bg[2]),
      fontSizePx: Math.round(fontSizePx * 10) / 10,
      fontWeight,
      isLargeText,
      ratio,
      passAA: ratio >= aaThreshold,
      passAAA: ratio >= aaaThreshold,
    };
  };
})();
