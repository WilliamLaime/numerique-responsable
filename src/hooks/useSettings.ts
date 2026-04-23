import { useEffect } from 'react';
import { useAuditStore } from '../store/auditStore';

const SETTINGS_KEY = 'nrSettings';
const SETTINGS_DEFAULT = { concurrency: 4, settleDelay: 800 };
const SETTINGS_BOUNDS = {
  concurrency: { min: 1, max: 8 },
  settleDelay: { min: 0, max: 5000 },
} as const;

function clamp(key: keyof typeof SETTINGS_DEFAULT, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return SETTINGS_DEFAULT[key];
  const { min, max } = SETTINGS_BOUNDS[key];
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function useSettings() {
  const setConcurrency = useAuditStore((s) => s.setConcurrency);
  const setSettleDelay = useAuditStore((s) => s.setSettleDelay);
  const concurrency = useAuditStore((s) => s.concurrency);
  const settleDelay = useAuditStore((s) => s.settleDelay);

  useEffect(() => {
    chrome.storage.local.get(SETTINGS_KEY).then((result: Record<string, unknown>) => {
      const saved = result[SETTINGS_KEY] as Partial<typeof SETTINGS_DEFAULT> | undefined;
      const settings = { ...SETTINGS_DEFAULT, ...(saved ?? {}) };
      setConcurrency(clamp('concurrency', settings.concurrency));
      setSettleDelay(clamp('settleDelay', settings.settleDelay));
    });
  }, [setConcurrency, setSettleDelay]);

  const persist = (c: number, s: number) =>
    chrome.storage.local.set({ [SETTINGS_KEY]: { concurrency: c, settleDelay: s } });

  const updateConcurrency = (val: unknown): number => {
    const n = clamp('concurrency', val);
    setConcurrency(n);
    persist(n, settleDelay);
    return n;
  };

  const updateSettleDelay = (val: unknown): number => {
    const n = clamp('settleDelay', val);
    setSettleDelay(n);
    persist(concurrency, n);
    return n;
  };

  return { concurrency, settleDelay, updateConcurrency, updateSettleDelay };
}
