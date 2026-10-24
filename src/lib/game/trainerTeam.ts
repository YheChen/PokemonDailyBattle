/**
 * Converts trainer data (src/data/trainers) into Showdown `PokemonSet`s the engine accepts.
 */
import type { PokemonSet } from '@pkmn/sim';
import type { Trainer, TrainerPokemon } from '@/data/trainers/types';
import { GEN9_ONLY_FORMAT } from '@/lib/battle/types';
import type { BattleLevel } from '@/lib/teams/types';

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatsTable = Record<StatKey, number>;

export const STAT_KEYS: readonly StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

/**
 * Fills a partial stats table so every key is present. Missing keys get `fill`; present values are
 * clamped to `[0, max]`.
 */
export function fillStats(partial: Partial<Record<StatKey, number>> | undefined, fill: number, max: number): StatsTable {
  const out = {} as StatsTable;
  for (const k of STAT_KEYS) {
    const v = partial?.[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : fill;
  }
  return out;
}

/** EV table with every key present (0 default, 252 cap). */
export function fillEvs(partial: Partial<Record<StatKey, number>> | undefined): StatsTable {
  return fillStats(partial, 0, 252);
}

/** IV table with every key present (31 default, 31 cap). */
export function fillIvs(partial: Partial<Record<StatKey, number>> | undefined): StatsTable {
  return fillStats(partial, 31, 31);
}

/** Builds the Showdown set for one trainer Pokémon at the given level. */
export function trainerPokemonToSet(p: TrainerPokemon, level: BattleLevel): PokemonSet {
  const set: PokemonSet = {
    name: p.nickname ?? p.species,
    species: p.species,
    item: p.item ?? '',
    ability: p.ability,
    moves: [...p.moves],
    nature: p.nature,
    gender: p.gender ?? '',
    evs: fillEvs(p.evs),
    ivs: fillIvs(p.ivs),
    level,
  };
  if (p.shiny) set.shiny = true;
  if (p.teraType) set.teraType = p.teraType;
  return set;
}

/* ---- format gimmicks (Mega Stones / Z-Crystals / Primal orbs) ---- */

/** Showdown item ids of every Mega Stone known to the gen 9 dex (`item.megaStone`), CAP stones included. */
export const MEGA_STONE_IDS: readonly string[] = [
  'abomasite', 'absolite', 'absolitez', 'aerodactylite', 'aggronite', 'alakazite', 'altarianite', 'ampharosite', 'audinite',
  'banettite', 'barbaracite', 'baxcalibrite', 'beedrillite', 'blastoisinite', 'blazikenite', 'cameruptite', 'chandelurite',
  'charizarditex', 'charizarditey', 'chesnaughtite', 'chimechite', 'clefablite', 'crabominite', 'crucibellite', 'darkranite',
  'delphoxite', 'diancite', 'dragalgite', 'dragoninite', 'drampanite', 'eelektrossite', 'emboarite', 'excadrite', 'falinksite',
  'feraligite', 'floettite', 'froslassite', 'galladite', 'garchompite', 'garchompitez', 'gardevoirite', 'gengarite', 'glalitite',
  'glimmoranite', 'golisopite', 'golurkite', 'greninjite', 'gyaradosite', 'hawluchanite', 'heatranite', 'heracronite',
  'houndoominite', 'kangaskhanite', 'latiasite', 'latiosite', 'lopunnite', 'lucarionite', 'lucarionitez', 'magearnite',
  'malamarite', 'manectite', 'mawilite', 'medichamite', 'meganiumite', 'meowsticite', 'metagrossite', 'mewtwonitex',
  'mewtwonitey', 'pidgeotite', 'pinsirite', 'pyroarite', 'raichunitex', 'raichunitey', 'sablenite', 'salamencite', 'sceptilite',
  'scizorite', 'scolipite', 'scovillainite', 'scraftinite', 'sharpedonite', 'skarmorite', 'slowbronite', 'staraptite',
  'starminite', 'steelixite', 'swampertite', 'tatsugirinite', 'tyranitarite', 'venusaurite', 'victreebelite', 'zeraorite',
  'zygardite',
];

/** Showdown item ids of every Z-Crystal (`item.zMove`). */
export const Z_CRYSTAL_IDS: readonly string[] = [
  'aloraichiumz', 'buginiumz', 'darkiniumz', 'decidiumz', 'dragoniumz', 'eeviumz', 'electriumz', 'fairiumz', 'fightiniumz',
  'firiumz', 'flyiniumz', 'ghostiumz', 'grassiumz', 'groundiumz', 'iciumz', 'inciniumz', 'kommoniumz', 'lunaliumz', 'lycaniumz',
  'marshadiumz', 'mewniumz', 'mimikiumz', 'normaliumz', 'pikaniumz', 'pikashuniumz', 'poisoniumz', 'primariumz', 'psychiumz',
  'rockiumz', 'snorliumz', 'solganiumz', 'steeliumz', 'tapuniumz', 'ultranecroziumz', 'wateriumz',
];

/** Primal Reversion orbs (Kyogre / Groudon). */
export const PRIMAL_ORB_IDS: readonly string[] = ['blueorb', 'redorb'];

/** Items that trigger Mega Evolution, Z-Moves or Primal Reversion — none of which exist in the Gen 9 only format. */
export const GIMMICK_ITEM_IDS: ReadonlySet<string> = new Set([...MEGA_STONE_IDS, ...Z_CRYSTAL_IDS, ...PRIMAL_ORB_IDS]);

function itemId(item: string): string {
  return item.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isGimmickItem(item: string | undefined): boolean {
  return !!item && GIMMICK_ITEM_IDS.has(itemId(item));
}

/** True for the "Gen 9 only" format (no Megas / Z-Moves), ignoring custom rules after `@@@`. */
export function isGen9OnlyFormat(formatid: string | undefined): boolean {
  if (!formatid) return false;
  return formatid.split('@@@')[0] === GEN9_ONLY_FORMAT.split('@@@')[0];
}

/** The item a gimmick holder gets instead: Life Orb for offensive EV spreads, Leftovers otherwise. */
export function replacementItem(set: Pick<PokemonSet, 'evs'>): 'Life Orb' | 'Leftovers' {
  const atk = set.evs?.atk ?? 0;
  const spa = set.evs?.spa ?? 0;
  return atk >= 200 || spa >= 200 ? 'Life Orb' : 'Leftovers';
}

/** Copies of `sets` with every Mega Stone / Z-Crystal / Primal orb replaced by a sane held item. */
export function stripGimmickItems(sets: readonly PokemonSet[]): PokemonSet[] {
  return sets.map((s) => (isGimmickItem(s.item) ? { ...s, item: replacementItem(s) } : { ...s }));
}

/**
 * The trainer's six Pokémon as Showdown sets (party order preserved, lead = index 0). In the Gen 9 only
 * format the sets lose their Mega Stones / Z-Crystals so the trainer cannot Mega Evolve despite the label.
 */
export function trainerToSets(trainer: Trainer, level: BattleLevel, opts: { formatid?: string } = {}): PokemonSet[] {
  const sets = trainer.team.map((p) => trainerPokemonToSet(p, level));
  return isGen9OnlyFormat(opts.formatid) ? stripGimmickItems(sets) : sets;
}
