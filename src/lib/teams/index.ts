/**
 * Public API for random team generation.
 */
import type { PokemonSet } from '@pkmn/sim';
import type { GeneratedPokemon, GeneratedTeam } from './types';
import { roleLabel } from './spreads';

export { generateTeam } from './generate';
export { getSpeciesPool, getViablePool, settingsKey } from './pool';
export { DEFAULT_TEAM_SETTINGS, GENERATION_PRESETS } from './types';
export type { TeamGenSettings, GeneratedTeam, GeneratedPokemon, Generation, GenerationMode, LegendaryPolicy, BattleLevel } from './types';

/** The plain Showdown sets of a generated team (lead = index 0). */
export function toSets(team: GeneratedTeam): PokemonSet[] {
  return team.pokemon.map((p) => p.set);
}

/** Returns a copy of the sets with `sets[index]` moved to the front (the lead). */
export function reorderLead(sets: PokemonSet[], index: number): PokemonSet[] {
  if (index <= 0 || index >= sets.length) return [...sets];
  const out = [...sets];
  const [lead] = out.splice(index, 1);
  out.unshift(lead);
  return out;
}

function isGenerated(x: GeneratedPokemon | PokemonSet): x is GeneratedPokemon {
  return typeof (x as GeneratedPokemon).role === 'string' && (x as GeneratedPokemon).set !== undefined;
}

/** Human-readable role, inferred from the EV spread when only a plain set is given. */
export function describeRole(p: GeneratedPokemon | PokemonSet): string {
  if (isGenerated(p)) return roleLabel(p.role);
  const evs = p.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const tr = (p.ivs?.spe ?? 31) === 0;
  if (evs.atk >= 200 && evs.spa >= 100) return 'Mixed Attacker';
  if (evs.atk >= 128 && evs.spa >= 128) return 'Mixed Attacker';
  if (evs.atk >= 200) return tr ? 'Trick Room Attacker' : evs.spe >= 200 ? 'Physical Sweeper' : 'Bulky Physical Attacker';
  if (evs.spa >= 200) return tr ? 'Trick Room Special Attacker' : evs.spe >= 200 ? 'Special Sweeper' : 'Bulky Special Attacker';
  if (evs.def >= 200) return 'Physical Wall';
  if (evs.spd >= 200) return 'Special Wall';
  if (evs.hp >= 200) return 'Support';
  return 'Chaos';
}

/** One-line summary: "Garchomp @ Rocky Helmet | Rough Skin | Jolly | Earthquake / Outrage / Stealth Rock / Spikes". */
export function summarizeSet(p: GeneratedPokemon | PokemonSet): string {
  const set = isGenerated(p) ? p.set : p;
  const item = set.item ? ` @ ${set.item}` : '';
  return `${set.species}${item} | ${set.ability} | ${set.nature} | ${set.moves.join(' / ')}`;
}
