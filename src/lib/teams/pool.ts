/**
 * Species pools for team generation plus the shared, lazily loaded generation context
 * (gen 9 dex, Showdown random-battle generators, cached learnsets).
 *
 * Everything here is deterministic and side-effect free apart from in-process caches.
 */
import type { PRNG } from '@pkmn/sim';
import {
  getDex,
  isSelectableSpecies,
  legendaryClass,
  fullLearnset,
  baseStatTotal,
  type ModdedDex,
  type Species,
} from '@/lib/data/dex';
import type { Generation, LegendaryPolicy, TeamGenSettings } from './types';

/** Showdown-style id normalisation (lowercase alphanumerics). */
export function toId(text: string | undefined | null): string {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Canonical cache key for a settings object (order-insensitive for `gens`). */
export function settingsKey(settings: TeamGenSettings): string {
  const gens = [...new Set(settings.gens)].sort((a, b) => a - b).join('');
  return `${settings.mode}|g${gens}|${settings.legendaries}|L${settings.level}`;
}

/** Random-battle generator generations we consult, in priority order. */
export const GENERATOR_GENS = [9, 8, 7, 6, 5, 4, 3] as const;
export type GeneratorGen = (typeof GENERATOR_GENS)[number];

/** Minimal view of a @pkmn/randoms generator (the package types `randomSet` loosely). */
export interface RandomSetResult {
  name: string;
  species: string;
  gender?: string | boolean;
  moves: string[];
  ability: string;
  item: string;
  evs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  ivs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  level?: number;
  shiny?: boolean;
  nature?: string;
  teraType?: string;
  role?: string;
}
export interface RandomGenerator {
  randomSets: Record<string, unknown>;
  setSeed(prng: PRNG): void;
  randomSet(species: string, teamDetails: Record<string, unknown>, isLead: boolean, isDoubles: boolean): RandomSetResult;
}

export interface GenContext {
  dex: ModdedDex;
  generators: Map<GeneratorGen, RandomGenerator>;
  /** Species ids that have a random-battle set in the gen 9, 8 or 7 generator. */
  viableIds: Set<string>;
  /** Every selectable National Dex species, in dex order. */
  selectable: Species[];
  /** Learnset (move ids that exist in the gen 9 dex and are standard or 'Past'), cached per species id. */
  learnset(speciesId: string): Promise<Set<string>>;
}

let ctxPromise: Promise<GenContext> | null = null;

/** Loads the dex and the random-battle generators once per process. */
export function getGenContext(): Promise<GenContext> {
  if (!ctxPromise) {
    ctxPromise = (async () => {
      const [dex, randoms, sim] = await Promise.all([getDex(), import('@pkmn/randoms'), import('@pkmn/sim')]);
      const generators = new Map<GeneratorGen, RandomGenerator>();
      const bootstrap = new sim.PRNG('1,2,3,4');
      for (const gen of GENERATOR_GENS) {
        const g = randoms.TeamGenerators.getTeamGenerator(`gen${gen}randombattle`, bootstrap);
        // The package types `randomSet` loosely; narrow it once here (sim boundary).
        generators.set(gen, g as unknown as RandomGenerator);
      }
      const viableIds = new Set<string>();
      for (const gen of [9, 8, 7] as const) {
        for (const id of Object.keys(generators.get(gen)!.randomSets)) viableIds.add(id);
      }
      const learnsets = new Map<string, Promise<Set<string>>>();
      const learnset = (speciesId: string): Promise<Set<string>> => {
        let p = learnsets.get(speciesId);
        if (!p) {
          p = fullLearnset(dex, speciesId).then((raw) => {
            const out = new Set<string>();
            for (const id of raw) {
              const m = dex.moves.get(id);
              if (!m.exists || m.isZ || m.isMax) continue;
              if (m.isNonstandard !== null && m.isNonstandard !== 'Past') continue;
              out.add(m.id);
            }
            return out;
          });
          learnsets.set(speciesId, p);
        }
        return p;
      };
      const selectable = dex.species.all().filter((s) => isSelectableSpecies(s, dex));
      return { dex, generators, viableIds, selectable, learnset };
    })();
  }
  return ctxPromise;
}

/** True when any generator (gen 3–9) has a random-battle set for the species. */
export function hasGeneratorSet(ctx: GenContext, speciesId: string): boolean {
  for (const g of ctx.generators.values()) if (g.randomSets[speciesId]) return true;
  return false;
}

function passesLegendaryPolicy(s: Species, policy: LegendaryPolicy): boolean {
  const cls = legendaryClass(s);
  if (policy === 'all') return true;
  if (cls === 'restricted' || cls === 'mythical') return false;
  if (policy === 'no-restricted') return true;
  return cls === 'none';
}

const poolCache = new Map<string, Promise<Species[]>>();

/** Key for the species pool: everything except `mode` and `level` (they don't change the base pool). */
function poolKey(settings: TeamGenSettings): string {
  const gens = [...new Set(settings.gens)].sort((a, b) => a - b).join('');
  return `g${gens}|${settings.legendaries}`;
}

/**
 * The filtered National Dex pool for the settings (generation + legendary policy), in dex order.
 * Forms with a required item/ability/move are kept only when a random-battle set exists to supply it,
 * and species that cannot learn four distinct moves (Ditto, Unown) are excluded so every set has four moves.
 * Memoized per settings key.
 */
export function getSpeciesPool(settings: TeamGenSettings): Promise<Species[]> {
  const key = poolKey(settings);
  let p = poolCache.get(key);
  if (!p) {
    p = (async () => {
      const ctx = await getGenContext();
      const gens = new Set<Generation>(settings.gens);
      const out: Species[] = [];
      for (const s of ctx.selectable) {
        if (!gens.has(s.gen as Generation)) continue;
        if (!passesLegendaryPolicy(s, settings.legendaries)) continue;
        if ((s.requiredItem || s.requiredAbility || s.requiredMove) && !hasGeneratorSet(ctx, s.id)) continue;
        const ls = await ctx.learnset(s.id);
        if (ls.size < 4) continue;
        out.push(s);
      }
      return out;
    })();
    poolCache.set(key, p);
  }
  return p;
}

/** Pool restricted to species with a gen 9/8/7 random-battle set ("viable" Pokémon), for balanced/competitive modes. */
export async function getViablePool(settings: TeamGenSettings): Promise<Species[]> {
  const [ctx, pool] = await Promise.all([getGenContext(), getSpeciesPool(settings)]);
  return pool.filter((s) => ctx.viableIds.has(s.id));
}

/** Competitive-mode weight: BST ≥ 560 → 5, ≥ 500 → 3, else 1. */
export function competitiveWeight(s: Species): number {
  const bst = baseStatTotal(s);
  if (bst >= 560) return 5;
  if (bst >= 500) return 3;
  return 1;
}

/** Weighted sample with integer weights using the sim PRNG. */
export function weightedSample<T>(prng: PRNG, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let r = prng.random(total);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
