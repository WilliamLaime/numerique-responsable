export function nrToast(
  message: string,
  { duration = 2200, tone = 'success' }: { duration?: number; tone?: string } = {},
): void {
  let host = document.getElementById('nr-toast') as (HTMLDivElement & { _nrTimer?: ReturnType<typeof setTimeout> }) | null;
  if (!host) {
    host = document.createElement('div') as HTMLDivElement & { _nrTimer?: ReturnType<typeof setTimeout> };
    host.id = 'nr-toast';
    host.className = 'nr-toast';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  host.textContent = message;
  host.dataset.tone = tone;
  host.classList.add('show');
  if (host._nrTimer) clearTimeout(host._nrTimer);
  host._nrTimer = setTimeout(() => host!.classList.remove('show'), duration);
}
