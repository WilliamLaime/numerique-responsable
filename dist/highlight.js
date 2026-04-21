globalThis.__nrHighlight = function (auditId) {
  const el = document.querySelector(`[data-nr-audit-id="${CSS.escape(auditId)}"]`);
  if (!el) return false;

  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  } catch { el.scrollIntoView(); }

  const prev = {
    outline: el.style.outline,
    outlineOffset: el.style.outlineOffset,
    boxShadow: el.style.boxShadow,
    transition: el.style.transition
  };

  el.style.transition = 'outline-color 0.3s ease, box-shadow 0.3s ease';
  el.style.outline = '3px solid #c13535';
  el.style.outlineOffset = '3px';
  el.style.boxShadow = '0 0 0 6px rgba(193, 53, 53, 0.25)';

  setTimeout(() => {
    el.style.outline = prev.outline;
    el.style.outlineOffset = prev.outlineOffset;
    el.style.boxShadow = prev.boxShadow;
    el.style.transition = prev.transition;
  }, 3000);

  return true;
};
