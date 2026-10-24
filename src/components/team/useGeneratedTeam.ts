'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { generateTeam, settingsKey, toSets, type GeneratedTeam, type TeamGenSettings } from '@/lib/teams';

interface Loaded {
  /** Request key the data belongs to. */
  key: string;
  team: GeneratedTeam | null;
  error: string | null;
}

export interface GeneratedTeamState {
  /** Generated team (null while loading / on error). */
  team: GeneratedTeam | null;
  /** Plain Showdown sets of `team` (empty while loading). */
  sets: PokemonSet[];
  /** Role labels per set (from the generator). */
  roles: string[];
  loading: boolean;
  error: string | null;
  /** Re-run the generation with the same settings and seed (after an error). */
  retry: () => void;
}

const EMPTY_SETS: PokemonSet[] = [];
const EMPTY_ROLES: string[] = [];

/**
 * Generates a team for `settings` + `seed` on the client. Re-generates whenever the settings or the
 * seed change; `seed === null` disables generation (idle state).
 */
export function useGeneratedTeam(settings: TeamGenSettings | null, seed: string | null): GeneratedTeamState {
  const [attempt, setAttempt] = useState(0);
  const key = settings && seed ? `${settingsKey(settings)}|${seed}|${attempt}` : '';
  const [loaded, setLoaded] = useState<Loaded>({ key: '', team: null, error: null });

  useEffect(() => {
    if (!key || !settings || !seed) return;
    let alive = true;
    generateTeam(settings, seed)
      .then((team) => {
        if (alive) setLoaded({ key, team, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setLoaded({ key, team: null, error: errorMessage(err) });
      });
    return () => {
      alive = false;
    };
    // `key` captures the settings/seed/attempt identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const current = loaded.key === key ? loaded : null;
  const team = current?.team ?? null;
  const sets = useMemo(() => (team ? toSets(team) : EMPTY_SETS), [team]);
  const roles = useMemo(() => (team ? team.pokemon.map((p) => p.role) : EMPTY_ROLES), [team]);

  return {
    team,
    sets,
    roles,
    loading: !!key && !current,
    error: current?.error ?? null,
    retry,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Team generation failed';
}
