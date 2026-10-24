/**
 * Chaos mode: random learnable moves, random legal ability, a fun random item, random nature and random EVs.
 */
import type { PRNG } from '@pkmn/sim';
import type { Species } from '@/lib/data/dex';
import { toId, type GenContext } from './pool';
import { rankAbilities, requiredItem } from './fallbackSet';

/** Curated "fun" items for chaos sets. */
export const CHAOS_ITEMS = [
  'Leftovers', 'Life Orb', 'Choice Band', 'Choice Specs', 'Choice Scarf', 'Focus Sash', 'Assault Vest', 'Eviolite',
  'Rocky Helmet', 'Heavy-Duty Boots', 'Sitrus Berry', 'Lum Berry', 'Salac Berry', 'Liechi Berry', 'Custap Berry',
  'Weakness Policy', 'Air Balloon', 'Eject Button', 'Red Card', 'Quick Claw', 'Bright Powder', 'King\'s Rock',
  'Shell Bell', 'Black Sludge', 'Expert Belt', 'Loaded Dice', 'Covert Cloak', 'Booster Energy', 'Throat Spray',
  'Room Service', 'Metronome', 'Toxic Orb', 'Flame Orb', 'Sticky Barb', 'Lagging Tail', 'Iron Ball', 'Wide Lens',
  'Scope Lens', 'Binding Band', 'Protective Pads', 'Punching Glove', 'Clear Amulet', 'Mirror Herb', 'Ability Shield',
  'Big Root', 'Terrain Extender', 'Light Clay', 'Zoom Lens', 'Muscle Band', 'Wise Glasses', 'Normal Gem', 'Leppa Berry',
];

export const NATURES = [
  'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile', 'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly',
  'Lax', 'Lonely', 'Mild', 'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid',
];

export interface ChaosSet {
  moves: string[];
  ability: string;
  item: string;
  nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
}

/** Random EVs: each stat a multiple of 4 in [0, 252], scaled down so the total is ≤ 510. */
export function randomEvs(prng: PRNG): ChaosSet['evs'] {
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let total = 0;
  for (const k of keys) {
    evs[k] = prng.random(64) * 4;
    total += evs[k];
  }
  if (total > 510) {
    const scale = 510 / total;
    total = 0;
    for (const k of keys) {
      evs[k] = Math.floor((evs[k] * scale) / 4) * 4;
      total += evs[k];
    }
  }
  return evs;
}

/** Builds a chaos set: 4 random learnable moves (≥ 1 damaging), random legal ability, fun item, nature and EVs. */
export async function buildChaosSet(ctx: GenContext, species: Species, prng: PRNG): Promise<ChaosSet> {
  const { dex } = ctx;
  const learnset = [...(await ctx.learnset(species.id))].sort();
  const moves: string[] = [];
  const req = species.requiredMove ? toId(species.requiredMove) : '';
  if (req && learnset.includes(req)) moves.push(req);
  const damaging = learnset.filter((id) => {
    const m = dex.moves.get(id);
    return m.category !== 'Status' && m.basePower > 0 && id !== 'struggle';
  });
  if (damaging.length && !moves.some((id) => damaging.includes(id))) moves.push(prng.sample(damaging));
  const remaining = learnset.filter((id) => !moves.includes(id));
  prng.shuffle(remaining);
  for (const id of remaining) {
    if (moves.length >= 4) break;
    moves.push(id);
  }
  const abilities = rankAbilities(dex, species);
  const ability = abilities.length ? prng.sample(abilities) : 'No Ability';
  const item = requiredItem(species) ?? prng.sample(CHAOS_ITEMS);
  const nature = prng.sample(NATURES);
  const evs = randomEvs(prng);
  return { moves, ability, item, nature, evs };
}
