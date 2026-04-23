const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid',
];

const BINARY_EXT_RE = /\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|mp4|mp3|doc|docx|xls|xlsx)(\?|$)/i;

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    TRACKING_PARAMS.forEach((p) => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, '');
  } catch {
    return u;
  }
}

export function addIfSameOrigin(set: Set<string>, href: string, origin: string): void {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin) return;
    if (!/^https?:$/.test(u.protocol)) return;
    if (BINARY_EXT_RE.test(u.pathname)) return;
    set.add(normalizeUrl(u.toString()));
  } catch {
    // URL invalide — ignorée silencieusement
  }
}
