'use client';
import { useEffect, useState } from 'react';
import { getDex, type ModdedDex } from '@/lib/data/dex';

let cached: ModdedDex | null = null;

/**
 * The shared gen 9 dex, loaded lazily on the client. `null` until it is ready (and on the server).
 */
export function useDex(): ModdedDex | null {
  const [dex, setDex] = useState<ModdedDex | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    getDex()
      .then((d) => {
        cached = d;
        if (alive) setDex(d);
      })
      .catch(() => {
        /* the preview degrades gracefully without dex details */
      });
    return () => {
      alive = false;
    };
  }, []);
  return dex;
}
