'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { subscribeStorage, getStats, getSettings, DEFAULT_SETTINGS, STORAGE_KEYS } from './index';
import { DEFAULT_STATS, type PlayerStats, type UserSettings } from './types';

/**
 * Subscribes a component to the raw localStorage string of a key (null on the server / when unset).
 * Re-renders only when the stored string changes.
 */
export function useStorageRaw(key: string): string | null {
  const subscribe = useCallback(
    (cb: () => void) =>
      subscribeStorage((changed) => {
        if (changed === key) cb();
      }),
    [key],
  );
  const get = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  return useSyncExternalStore(subscribe, get, () => null);
}

/** Parsed + default-merged player stats, reactive to changes. */
export function useStats(): PlayerStats {
  const raw = useStorageRaw(STORAGE_KEYS.stats);
  // useMemo keyed on the raw string: the same stored JSON yields the same object identity.
  return useMemo(() => (raw == null ? DEFAULT_STATS : getStats()), [raw]);
}

/** Parsed + default-merged user settings, reactive to changes. */
export function useSettings(): UserSettings {
  const raw = useStorageRaw(STORAGE_KEYS.settings);
  return useMemo(() => (raw == null ? DEFAULT_SETTINGS : getSettings()), [raw]);
}

/** True once the component has mounted on the client (localStorage readable). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
