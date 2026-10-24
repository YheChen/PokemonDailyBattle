/**
 * Shared access to Pokémon Showdown dex data (via @pkmn/dex) for UI and generators.
 * The dex is loaded lazily with a dynamic import so landing pages don't pay for it.
 */
import type { ModdedDex, Species, Move, Ability, Item, Learnset } from '@pkmn/dex';
import type { TypeName } from '@/lib/battle/types';

let dexPromise: Promise<ModdedDex> | null = null;

/** Gen 9 dex (National Dex data: species/moves/items from all generations are present, tagged isNonstandard 'Past'). */
export function getDex(): Promise<ModdedDex> {
  if (!dexPromise) {
    dexPromise = import('@pkmn/dex').then((mod) => mod.Dex.forGen(9));
    // A failed import must not poison the cache: let the next caller retry.
    dexPromise.catch(() => {
      dexPromise = null;
    });
  }
  return dexPromise;
}

export type { Species, Move, Ability, Item, Learnset, ModdedDex };

/** True for species that are part of the National Dex (no CAP/Custom/LGPE/Future). */
export function isNatDexSpecies(s: Species): boolean {
  return s.num > 0 && (s.isNonstandard === null || s.isNonstandard === 'Past');
}

/** Forms that only differ cosmetically (or are event cosplay) but are not listed under the base species' `cosmeticFormes`. */
const COSMETIC_NAME =
  /^(Pikachu-.+|Eevee-Starter|Magearna-Original|Poltchageist-Artisan|Sinistcha-Masterpiece|Sinistea-Antique|Polteageist-Antique|Vivillon-(Fancy|Pokeball)|Pichu-Spiky-eared)$/;
/** Cosmetic forme names that appear as their own species entries (Unown-B, Vivillon-Marine, Alcremie-…, Minior-Orange, …). */
const COSMETIC_FORME =
  /^(Unown|Burmy|Shellos|Gastrodon|Deerling|Sawsbuck|Vivillon|Flabébé|Floette|Florges|Furfrou|Minior|Alcremie|Tatsugiri|Maushold|Dudunsparce)-/;
const COSMETIC_FORME_EXCEPTIONS = new Set(['Floette-Eternal']);

/**
 * Species usable as a team member (not battle-only, not a Mega/Primal/G-Max/Totem/cap form, not a purely cosmetic forme).
 * Regional forms and standalone alternate forms (Rotom-Wash, Lycanroc-Dusk, Giratina-Origin, Ursaluna-Bloodmoon, …) are kept.
 * Pass the dex to additionally honour the base species' `cosmeticFormes` list.
 */
export function isSelectableSpecies(s: Species, dex?: ModdedDex): boolean {
  if (!isNatDexSpecies(s)) return false;
  if (s.battleOnly) return false;
  if (s.isMega || s.isPrimal) return false;
  if (s.forme && /^(Mega|Mega-X|Mega-Y|Primal|Gmax|Totem|Eternamax)$/.test(s.forme)) return false;
  if (/-(Totem|Gmax|Eternamax)$/.test(s.name)) return false;
  if (COSMETIC_NAME.test(s.name)) return false;
  if (COSMETIC_FORME.test(s.name) && !COSMETIC_FORME_EXCEPTIONS.has(s.name)) return false;
  if (dex && s.forme && s.baseSpecies !== s.name) {
    const base = dex.species.get(s.baseSpecies);
    if (base.exists && base.cosmeticFormes?.includes(s.name)) return false;
  }
  if (s.baseSpecies === 'Pokestar' || s.baseSpecies === 'Missingno' || s.num > 1025) return false;
  return true;
}

/** Legendary classification from Showdown species tags. */
export type LegendaryClass = 'none' | 'sub' | 'restricted' | 'mythical' | 'ultrabeast' | 'paradox';
export function legendaryClass(s: Species): LegendaryClass {
  const tags = s.tags ?? [];
  if (tags.includes('Restricted Legendary')) return 'restricted';
  if (tags.includes('Mythical')) return 'mythical';
  if (tags.includes('Sub-Legendary')) return 'sub';
  if (tags.includes('Ultra Beast')) return 'ultrabeast';
  if (tags.includes('Paradox')) return 'paradox';
  return 'none';
}

export function baseStatTotal(s: Species): number {
  const b = s.baseStats;
  return b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
}

/** All move ids a species can learn in any generation, including inherited pre-evolution moves. */
export async function fullLearnset(dex: ModdedDex, speciesId: string): Promise<Set<string>> {
  const moves = new Set<string>();
  let species: Species | undefined = dex.species.get(speciesId);
  const seen = new Set<string>();
  while (species && species.exists && !seen.has(species.id)) {
    seen.add(species.id);
    const ls = await dex.learnsets.get(species.id);
    for (const id of Object.keys(ls?.learnset ?? {})) moves.add(id);
    // Forms without their own learnset inherit from the base species.
    if (species.forme && species.baseSpecies && species.baseSpecies !== species.name) {
      const base = dex.species.get(species.baseSpecies);
      const bls = await dex.learnsets.get(base.id);
      for (const id of Object.keys(bls?.learnset ?? {})) moves.add(id);
    }
    species = species.prevo ? dex.species.get(species.prevo) : undefined;
  }
  // Sketch users (Smeargle) can learn every sketchable move.
  if (moves.has('sketch')) {
    for (const m of dex.moves.all()) {
      if (!m.exists || m.isZ || m.isMax || m.flags.nosketch) continue;
      if (m.isNonstandard !== null && m.isNonstandard !== 'Past') continue;
      moves.add(m.id);
    }
  }
  return moves;
}

export function asTypeName(t: string): TypeName {
  return t as TypeName;
}
