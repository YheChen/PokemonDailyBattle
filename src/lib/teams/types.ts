import type { PokemonSet } from '@pkmn/sim';

export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type LegendaryPolicy = 'all' | 'no-restricted' | 'none';
export type GenerationMode = 'balanced' | 'random' | 'competitive' | 'chaos';
export type BattleLevel = 50 | 100;

export interface TeamGenSettings {
  /** Generations included in the pool (1–9). */
  gens: Generation[];
  legendaries: LegendaryPolicy;
  mode: GenerationMode;
  level: BattleLevel;
}

export const DEFAULT_TEAM_SETTINGS: TeamGenSettings = {
  gens: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  legendaries: 'no-restricted',
  mode: 'balanced',
  level: 100,
};

export const GENERATION_PRESETS: { id: string; label: string; gens: Generation[] }[] = [
  { id: 'gen1', label: 'Gen 1 only', gens: [1] },
  { id: 'gen1-3', label: 'Gen 1–3', gens: [1, 2, 3] },
  { id: 'gen1-5', label: 'Gen 1–5', gens: [1, 2, 3, 4, 5] },
  { id: 'gen1-7', label: 'Gen 1–7', gens: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'gen1-9', label: 'Gen 1–9', gens: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
];

/** A generated set plus display metadata used by the team preview UI. */
export interface GeneratedPokemon {
  set: PokemonSet;
  speciesId: string;
  gen: Generation;
  role: string;
  /** Which generator produced the set: 'gen9' | 'gen8' | 'gen7' | 'fallback' | 'chaos'. */
  source: string;
}

export interface GeneratedTeam {
  settings: TeamGenSettings;
  seed: string;
  pokemon: GeneratedPokemon[];
}
