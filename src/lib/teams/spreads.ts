/**
 * Role inference and competitive EV spreads / natures derived from a set's moves and the species' stats.
 */
import type { PokemonSet } from '@pkmn/sim';
import type { ModdedDex, Species, Move } from '@/lib/data/dex';
import { toId } from './pool';

export type Role =
  | 'physical'
  | 'special'
  | 'mixed'
  | 'physical-bulky'
  | 'special-bulky'
  | 'physical-wall'
  | 'special-wall'
  | 'support'
  | 'physical-tr'
  | 'special-tr'
  | 'chaos';

export const RECOVERY_MOVES = new Set([
  'recover', 'roost', 'slackoff', 'softboiled', 'synthesis', 'moonlight', 'morningsun', 'shoreup', 'milkdrink',
  'wish', 'rest', 'strengthsap', 'painsplit', 'junglehealing', 'lunarblessing', 'healorder', 'lifedew', 'purify',
]);

export const SETUP_PHYSICAL = new Set([
  'swordsdance', 'dragondance', 'bulkup', 'coil', 'honeclaws', 'shiftgear', 'victorydance', 'tidyup', 'curse',
  'bellydrum', 'howl', 'sharpen', 'meditate', 'shellsmash', 'workup', 'growth', 'noretreat', 'filletaway',
  'clangoroussoul', 'poweruppunch', 'rage', 'spicyextract', 'scaleshot', 'swordsdance',
]);
export const SETUP_SPECIAL = new Set([
  'nastyplot', 'calmmind', 'quiverdance', 'tailglow', 'geomancy', 'shellsmash', 'workup', 'growth', 'chargebeam',
  'fierydance', 'torchsong', 'takeheart', 'noretreat', 'filletaway', 'clangoroussoul', 'cosmicpower', 'agility',
]);
export const SETUP_DEFENSIVE = new Set([
  'irondefense', 'amnesia', 'cosmicpower', 'stockpile', 'acidarmor', 'barrier', 'defendorder', 'withdraw', 'harden',
  'cottonguard', 'bulkup', 'calmmind', 'coil',
]);

export const HAZARD_MOVES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge']);
export const STATUS_MOVES = new Set([
  'willowisp', 'thunderwave', 'toxic', 'glare', 'stunspore', 'sleeppowder', 'spore', 'hypnosis', 'yawn', 'nuzzle',
  'leechseed', 'encore', 'taunt', 'haze', 'whirlwind', 'roar', 'dragontail', 'circlethrow', 'defog', 'rapidspin',
  'mortalspin', 'tidyup', 'trick', 'switcheroo', 'healbell', 'aromatherapy', 'reflect', 'lightscreen',
  'auroraveil', 'protect', 'substitute', 'partingshot', 'teleport', 'batonpass', 'chillyreception', 'memento', 'perishsong', 'disable', 'torment', 'block', 'meanlook', 'spiderweb', 'thunderwave',
  'confuseray', 'swagger', 'attract', 'lovelykiss', 'darkvoid', 'grasswhistle', 'sing', 'poisonpowder', 'sandattack',
  'bodypress', 'foulplay', 'seismictoss', 'nightshade', 'counter', 'mirrorcoat', 'wish', 'shedtail', 'courtchange',
  'healingwish', 'lunardance',
]);
export const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'batonpass', 'chillyreception', 'shedtail']);

const BULKY_ITEMS = new Set(['assaultvest', 'leftovers', 'eviolite', 'rockyhelmet', 'heavydutyboots', 'blacksludge']);
/** Items that only make sense on an attacker: a set holding one is never treated as a wall. */
const OFFENSIVE_ITEMS = new Set([
  'lifeorb', 'choiceband', 'choicespecs', 'choicescarf', 'expertbelt', 'loadeddice', 'boosterenergy', 'weaknesspolicy',
  'throatspray', 'punchingglove', 'focussash', 'whiteherb', 'powerherb', 'normalgem', 'lightball', 'thickclub', 'deepseatooth',
]);

export interface RoleAnalysis {
  role: Role;
  physical: number;
  special: number;
  status: number;
  recovery: boolean;
  trickRoom: boolean;
  setupPhysical: boolean;
  setupSpecial: boolean;
}

function isDamaging(m: Move): boolean {
  return m.exists && m.category !== 'Status';
}

/** Infers the competitive role of a set from its moves, item and the species' base stats. */
export function inferRole(dex: ModdedDex, species: Species, set: PokemonSet): RoleAnalysis {
  const ids = set.moves.map((m) => toId(m));
  const moves = ids.map((id) => dex.moves.get(id));
  let physical = 0;
  let special = 0;
  let status = 0;
  for (const m of moves) {
    if (!isDamaging(m)) {
      status++;
      continue;
    }
    // Moves that don't use the user's attacking stats don't tell us about the role.
    if (['bodypress', 'foulplay', 'seismictoss', 'nightshade', 'counter', 'mirrorcoat', 'metalburst', 'superfang', 'ruination', 'naturesmadness'].includes(m.id)) {
      status++;
      continue;
    }
    // Weak utility attacks (Nuzzle, Rapid Spin, Super Fang…) say nothing about the attacking stat; priority moves do.
    if (m.basePower < 55 && m.priority <= 0) {
      status++;
      continue;
    }
    if (m.category === 'Physical') physical++;
    else special++;
  }
  const recovery = ids.some((id) => RECOVERY_MOVES.has(id));
  const trickRoom = ids.includes('trickroom') || ids.includes('gyroball');
  const setupPhysical = ids.some((id) => SETUP_PHYSICAL.has(id));
  const setupSpecial = ids.some((id) => SETUP_SPECIAL.has(id));
  const defensiveSetup = ids.some((id) => SETUP_DEFENSIVE.has(id));
  const supportMoves = ids.filter((id) => STATUS_MOVES.has(id) || HAZARD_MOVES.has(id)).length;
  const item = toId(set.item);
  const b = species.baseStats;
  const slow = b.spe < 60;
  const bulk = b.hp + b.def + b.spd;
  const bulky = bulk >= 260 || item === 'eviolite' || item === 'assaultvest';
  // Fast, frail Pokémon with strong attacking stats are attackers even when they carry two utility moves.
  const fastOffensive = b.spe >= 85 && Math.max(b.atk, b.spa) >= 80 && bulk < 300;

  const attacks = physical + special;
  let role: Role;
  const physScore = physical * b.atk;
  const specScore = special * b.spa;
  const offensiveCategory = (): 'physical' | 'special' | 'mixed' => {
    if (physical > 0 && special > 0) {
      const lo = Math.min(physScore, specScore);
      const hi = Math.max(physScore, specScore);
      if (lo / hi >= 0.6) return 'mixed';
    }
    if (physical === 0 && special === 0) return b.atk >= b.spa ? 'physical' : 'special';
    if (physical === special) return b.atk >= b.spa ? 'physical' : 'special';
    return physScore >= specScore ? 'physical' : 'special';
  };

  const defensive =
    attacks <= 2 &&
    (recovery || supportMoves >= 2 || defensiveSetup) &&
    !setupPhysical &&
    !setupSpecial &&
    !(fastOffensive && !recovery) &&
    !(attacks > 0 && OFFENSIVE_ITEMS.has(item));

  if (trickRoom && !defensive) {
    const cat = offensiveCategory();
    role = cat === 'special' ? 'special-tr' : 'physical-tr';
  } else if (defensive) {
    if (attacks === 0 && !recovery) role = 'support';
    else role = b.def <= b.spd ? 'physical-wall' : 'special-wall';
  } else {
    const cat = offensiveCategory();
    if (cat === 'mixed') role = 'mixed';
    else if (cat === 'physical') role = slow || (bulky && BULKY_ITEMS.has(item)) ? 'physical-bulky' : 'physical';
    else role = slow || (bulky && BULKY_ITEMS.has(item)) ? 'special-bulky' : 'special';
  }
  return { role, physical, special, status, recovery, trickRoom, setupPhysical, setupSpecial };
}

type StatsTable = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
const ZERO: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export interface Spread {
  evs: StatsTable;
  ivs: StatsTable;
  nature: string;
}

/**
 * Builds EVs / IVs / nature for the role.
 * `keepZeroAtk` keeps a 0 Atk IV when the set has no physical attack (confusion damage, Foul Play).
 */
export function buildSpread(species: Species, analysis: RoleAnalysis, keepZeroAtk: boolean): Spread {
  const b = species.baseStats;
  const evs: StatsTable = { ...ZERO };
  const ivs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  let nature = 'Serious';
  const fast = b.spe >= 75;
  const zeroAtk = keepZeroAtk && analysis.physical === 0 && !analysis.setupPhysical;
  if (zeroAtk) ivs.atk = 0;
  const lowerDef = b.def <= b.spd ? 'def' : 'spd';

  switch (analysis.role) {
    case 'physical':
      evs.atk = 252; evs.spe = 252; evs.hp = 4;
      nature = fast ? 'Jolly' : 'Adamant';
      break;
    case 'special':
      evs.spa = 252; evs.spe = 252; evs.hp = 4;
      nature = fast ? 'Timid' : 'Modest';
      break;
    case 'mixed':
      evs.atk = 128; evs.spa = 128;
      if (b.spe >= 60) { evs.spe = 252; nature = b.def >= b.spd ? 'Naive' : 'Hasty'; }
      else { evs.hp = 252; nature = b.spa >= b.atk ? 'Rash' : 'Naughty'; }
      break;
    case 'physical-bulky':
      evs.hp = 252; evs.atk = 252; evs[lowerDef] = 4;
      nature = 'Adamant';
      break;
    case 'special-bulky':
      evs.hp = 252; evs.spa = 252; evs[lowerDef] = 4;
      nature = 'Modest';
      break;
    case 'physical-wall':
      evs.hp = 252; evs.def = 252; evs.spd = 4;
      nature = analysis.physical > 0 ? 'Impish' : 'Bold';
      break;
    case 'special-wall':
      evs.hp = 252; evs.spd = 252; evs.def = 4;
      nature = analysis.physical > 0 ? 'Careful' : 'Calm';
      break;
    case 'support':
      evs.hp = 252; evs[lowerDef] = 252; evs[lowerDef === 'def' ? 'spd' : 'def'] = 4;
      nature = lowerDef === 'def' ? 'Bold' : 'Calm';
      break;
    case 'physical-tr':
      evs.hp = 252; evs.atk = 252; evs[lowerDef] = 4;
      nature = 'Brave'; ivs.spe = 0;
      break;
    case 'special-tr':
      evs.hp = 252; evs.spa = 252; evs[lowerDef] = 4;
      nature = 'Quiet'; ivs.spe = 0;
      break;
    case 'chaos':
      nature = 'Hardy';
      break;
  }
  // Defensive Trick Room / Gyro Ball users want to be as slow as possible.
  if (analysis.trickRoom && (analysis.role === 'physical-wall' || analysis.role === 'special-wall' || analysis.role === 'support')) {
    ivs.spe = 0;
    nature = evs.def >= evs.spd ? 'Relaxed' : 'Sassy';
  }
  return { evs, ivs, nature };
}

/** Human-readable label for a role id. */
export function roleLabel(role: string): string {
  switch (role) {
    case 'physical': return 'Physical Sweeper';
    case 'special': return 'Special Sweeper';
    case 'mixed': return 'Mixed Attacker';
    case 'physical-bulky': return 'Bulky Physical Attacker';
    case 'special-bulky': return 'Bulky Special Attacker';
    case 'physical-wall': return 'Physical Wall';
    case 'special-wall': return 'Special Wall';
    case 'support': return 'Support';
    case 'physical-tr': return 'Trick Room Attacker';
    case 'special-tr': return 'Trick Room Special Attacker';
    case 'chaos': return 'Chaos';
    default: return role;
  }
}
