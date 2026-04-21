import { useCallback, useEffect } from 'react';
import { useAuditStore } from '../store/auditStore';
import type { SavedAuditEntry } from '../types/audit';

const STORAGE_KEY = 'nrSavedAudits';

async function _getSaved(): Promise<SavedAuditEntry[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = result[STORAGE_KEY] as SavedAuditEntry[] | undefined;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function _setSaved(list: SavedAuditEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

async function _migrate(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length) {
      const existing = await _getSaved();
      if (!existing.length) await _setSaved(parsed as SavedAuditEntry[]);
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useStorage() {
  const setSavedAudits = useAuditStore((s) => s.setSavedAudits);

  const refresh = useCallback(async () => {
    const list = await _getSaved();
    setSavedAudits(list);
    return list;
  }, [setSavedAudits]);

  useEffect(() => {
    _migrate().then(() => refresh());
  }, [refresh]);

  const saveAudit = useCallback(
    async (entry: SavedAuditEntry): Promise<void> => {
      const list = await _getSaved();
      list.unshift(entry);
      await _setSaved(list);
      await refresh();
    },
    [refresh],
  );

  const deleteAudit = useCallback(
    async (id: string): Promise<void> => {
      const list = await _getSaved();
      await _setSaved(list.filter((a) => a.id !== id));
      await refresh();
    },
    [refresh],
  );

  const renameAudit = useCallback(
    async (id: string, newName: string): Promise<void> => {
      const list = await _getSaved();
      const entry = list.find((a) => a.id === id);
      if (entry) {
        entry.name = newName;
        await _setSaved(list);
      }
      await refresh();
    },
    [refresh],
  );

  return { refresh, saveAudit, deleteAudit, renameAudit };
}
