'use client';
import { useEffect, useState } from 'react';
import { getPokedexIndex, type PokedexEntry } from '@/lib/data/pokedex';

export interface PokedexIndexState {
  entries: PokedexEntry[] | null;
  error: string | null;
}

/** Loads the memoized Pokédex index (dynamic import of the dex) after mount. */
export function usePokedexIndex(): PokedexIndexState {
  const [state, setState] = useState<PokedexIndexState>({ entries: null, error: null });
  useEffect(() => {
    let alive = true;
    getPokedexIndex().then(
      (entries) => {
        if (alive) setState({ entries, error: null });
      },
      (err: unknown) => {
        if (alive) setState({ entries: null, error: err instanceof Error ? err.message : 'Failed to load the Pokédex.' });
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
