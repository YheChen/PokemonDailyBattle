/**
 * Deterministic random team generation (see ARCHITECTURE.md "Team generation contract").
 */
import type { PokemonSet, PRNG, PRNGSeed } from '@pkmn/sim';
import type { Species } from '@/lib/data/dex';
import { seedFromString } from '@/lib/util/seed';
import type { GeneratedPokemon, GeneratedTeam, Generation, TeamGenSettings } from './types';
import {
  GENERATOR_GENS,
  competitiveWeight,
  getGenContext,
  getSpeciesPool,
  getViablePool,
  settingsKey,
  toId,
  weightedSample,
  type GenContext,
  type GeneratorGen,
} from './pool';
import { buildFallbackSet, canLearn, chooseItem, fallbackRole, isLegalAbility, pickReplacementMove, rankAbilities, requiredItem } from './fallbackSet';
import { buildSpread, inferRole } from './spreads';
import { buildChaosSet } from './chaos';

const TEAM_SIZE = 6;
const MAX_CONSTRAINED_DRAWS = 200;
/** Moves that are legal but useless in our formats (Terastal Clause disables Terastallization, so Tera Blast is a plain 80 BP Normal move). */
const FORMAT_DEAD_MOVES = new Set(['terablast']);

type StatsTable = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

interface RawSet {
  moves: string[]; // ids
  ability: string; // name
  item: string; // name
  gender?: string;
  zeroAtkIv: boolean;
  source: string;
}

/** Fetches a random-battle set from the first generator (gen 9 → gen 3) that knows the species. */
function generatorSet(ctx: GenContext, species: Species): { set: RawSet; gen: GeneratorGen } | null {
  for (const gen of GENERATOR_GENS) {
    const g = ctx.generators.get(gen)!;
    if (!g.randomSets[species.id]) continue;
    let raw;
    try {
      raw = g.randomSet(species.id, {}, false, false);
    } catch {
      continue;
    }
    if (!raw || !raw.moves?.length) continue;
    const gender = typeof raw.gender === 'string' && /^[MFN]$/.test(raw.gender) ? raw.gender : undefined;
    return {
      gen,
      set: {
        moves: [...new Set(raw.moves.map(toId))],
        ability: raw.ability,
        item: raw.item ?? '',
        gender,
        zeroAtkIv: raw.ivs?.atk === 0,
        source: `gen${gen}`,
      },
    };
  }
  return null;
}

/** Repairs a generator set against the gen 9 dex: moves must exist and be learnable, ability legal, item real. */
async function validateSet(ctx: GenContext, species: Species, set: RawSet, prng: PRNG): Promise<RawSet> {
  const { dex } = ctx;
  const learnset = await ctx.learnset(species.id);
  const moves: string[] = [];
  for (const id of set.moves) {
    const m = dex.moves.get(id);
    const ok =
      m.exists &&
      !m.isZ &&
      !m.isMax &&
      !FORMAT_DEAD_MOVES.has(m.id) &&
      canLearn(learnset, m.id) &&
      (m.isNonstandard === null || m.isNonstandard === 'Past');
    if (ok && !moves.includes(m.id)) moves.push(m.id);
  }
  while (moves.length < 4) moves.push(await pickReplacementMove(ctx, species, moves, prng));
  let ability = set.ability;
  if (!isLegalAbility(dex, species, ability)) ability = rankAbilities(dex, species)[0] ?? 'No Ability';
  let item = set.item;
  const req = requiredItem(species);
  if (req) item = req;
  else if (item && !dex.items.get(item).exists) item = '';
  if (!item) {
    const role = fallbackRole(species, learnset);
    item = chooseItem(dex, species, moves, role, ability, prng);
  }
  return { ...set, moves, ability, item };
}

function finishSet(
  ctx: GenContext,
  species: Species,
  raw: RawSet,
  settings: TeamGenSettings,
  overrides?: { nature: string; evs: StatsTable; role: string },
): { set: PokemonSet; role: string } {
  const { dex } = ctx;
  const moveNames = raw.moves.map((id) => dex.moves.get(id).name);
  const base: PokemonSet = {
    name: species.baseSpecies,
    species: species.name,
    item: raw.item,
    ability: raw.ability,
    moves: moveNames,
    nature: 'Serious',
    gender: raw.gender ?? '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: settings.level,
  };
  if (overrides) {
    base.nature = overrides.nature;
    base.evs = overrides.evs;
    return { set: base, role: overrides.role };
  }
  const analysis = inferRole(dex, species, base);
  const spread = buildSpread(species, analysis, raw.zeroAtkIv || analysis.physical === 0);
  base.nature = spread.nature;
  base.evs = spread.evs;
  base.ivs = spread.ivs;
  return { set: base, role: analysis.role };
}

async function buildPokemon(ctx: GenContext, species: Species, settings: TeamGenSettings, prng: PRNG): Promise<GeneratedPokemon> {
  let set: PokemonSet;
  let role: string;
  let source: string;
  if (settings.mode === 'chaos') {
    const c = await buildChaosSet(ctx, species, prng);
    source = 'chaos';
    ({ set, role } = finishSet(ctx, species, { moves: c.moves, ability: c.ability, item: c.item, zeroAtkIv: false, source }, settings, {
      nature: c.nature,
      evs: c.evs,
      role: 'chaos',
    }));
  } else {
    const fromGen = generatorSet(ctx, species);
    let raw: RawSet;
    if (fromGen) {
      raw = await validateSet(ctx, species, fromGen.set, prng);
      source = fromGen.set.source;
    } else {
      const f = await buildFallbackSet(ctx, species, prng);
      source = 'fallback';
      raw = { moves: f.moves, ability: f.ability, item: f.item, zeroAtkIv: false, source };
    }
    ({ set, role } = finishSet(ctx, species, raw, settings));
  }
  return { set, speciesId: species.id, gen: species.gen as Generation, role, source };
}

/** Draws six species for balanced/competitive modes under the type / NFE / species-clause constraints. */
function drawConstrained(prng: PRNG, pool: Species[], weights: number[] | null): Species[] {
  const chosen: Species[] = [];
  const bases = new Set<string>();
  const typeCount = new Map<string, number>();
  let nfe = 0;
  let draws = 0;
  const pick = () => (weights ? weightedSample(prng, pool, weights) : prng.sample(pool));
  while (chosen.length < TEAM_SIZE && draws < 5000) {
    draws++;
    const s = pick();
    if (bases.has(s.baseSpecies)) continue;
    const relaxed = draws > MAX_CONSTRAINED_DRAWS;
    if (!relaxed) {
      if (s.types.some((t) => (typeCount.get(t) ?? 0) >= 2)) continue;
      if (s.nfe && nfe >= 1) continue;
    }
    chosen.push(s);
    bases.add(s.baseSpecies);
    for (const t of s.types) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    if (s.nfe) nfe++;
  }
  return chosen;
}

/** Uniform draw with only the species clause (random / chaos). */
function drawUniform(prng: PRNG, pool: Species[]): Species[] {
  const chosen: Species[] = [];
  const bases = new Set<string>();
  let draws = 0;
  while (chosen.length < TEAM_SIZE && draws < 5000) {
    draws++;
    const s = prng.sample(pool);
    if (bases.has(s.baseSpecies)) continue;
    chosen.push(s);
    bases.add(s.baseSpecies);
  }
  return chosen;
}

/** Serializes generateTeam calls (see below). */
let queue: Promise<void> = Promise.resolve();

/**
 * Generates a six-Pokémon team. Deterministic for the same settings + seed string.
 * Throws when the settings leave fewer than six base species in the pool.
 *
 * Calls are serialized: the random-battle generators share one PRNG that each call re-seeds,
 * so two overlapping calls must not interleave across `await`s.
 */
export function generateTeam(settings: TeamGenSettings, seed: string): Promise<GeneratedTeam> {
  const run = queue.then(() => generateTeamUnlocked(settings, seed));
  queue = run.then(() => undefined, () => undefined);
  return run;
}


async function generateTeamUnlocked(settings: TeamGenSettings, seed: string): Promise<GeneratedTeam> {
  const ctx = await getGenContext();
  const { PRNG } = await import('@pkmn/sim');
  const key = settingsKey(settings);
  const prng = new PRNG(seedFromString(`${seed}|${key}`) as PRNGSeed);
  for (const g of ctx.generators.values()) g.setSeed(prng);

  const constrained = settings.mode === 'balanced' || settings.mode === 'competitive';
  const pool = constrained ? await getViablePool(settings) : await getSpeciesPool(settings);
  if (new Set(pool.map((s) => s.baseSpecies)).size < TEAM_SIZE) {
    throw new Error(`Not enough species for settings ${key}: ${pool.length} candidates`);
  }
  const species = constrained
    ? drawConstrained(prng, pool, settings.mode === 'competitive' ? pool.map(competitiveWeight) : null)
    : drawUniform(prng, pool);

  const pokemon: GeneratedPokemon[] = [];
  for (const s of species) pokemon.push(await buildPokemon(ctx, s, settings, prng));
  return { settings: { ...settings, gens: [...settings.gens] }, seed, pokemon };
}
