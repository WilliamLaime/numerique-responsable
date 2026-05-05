import { useState, useCallback } from 'react';

export interface ContrastResult {
  text: string;
  fg: string;
  bg: string | null;
  fontSizePx: number;
  fontWeight: number;
  isLargeText: boolean;
  ratio: number | null;
  passAA: boolean | null;
  passAAA: boolean | null;
  error?: string;
}

export function useContrastChecker() {
  const [result, setResult] = useState<ContrastResult | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['contrast-checker.js'] });
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        func: () => (globalThis as any).__nrContrastCheck(),
      });
      setResult(res?.result ?? null);
    } catch {
      setResult({ error: 'injection-failed' } as ContrastResult);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, check, reset: () => setResult(null) };
}
