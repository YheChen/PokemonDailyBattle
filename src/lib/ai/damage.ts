/**
 * Damage model for the opponent AI.
 *
 * Uses `@smogon/calc` (gen 9) to estimate the damage a live sim Pokémon deals to another with a given move,
 * expressed both in HP and as a percentage of the target's *current* HP. Every calc call is wrapped in
 * try/catch and falls back to a simple base-power × STAB × effectiveness × stat-ratio formula, so the AI
 * never crashes on an exotic forme, move or item. Results are memoized per `DamageModel` instance, i.e. per
 * decision.
 */
import { calculate, Generations, Pokemon as CalcPokemon, Move as CalcMove, Field as CalcField } from '@smogon/calc';
import type { Battle, Move, Pokemon } from '@pkmn/sim';

const GEN = Generations.get(9);

type CalcMoveOptions = NonNullable<ConstructorParameters<typeof CalcMove>[2]>;
type CalcMoveOverrides = NonNullable<CalcMoveOptions['overrides']>;

export interface DamageEstimate {
  /** Minimum roll in HP. */
  min: number;
  /** Maximum roll in HP. */
  max: number;
  /** Minimum roll as % of the target's current HP. */
  minPct: number;
  /** Maximum roll as % of the target's current HP. */
  maxPct: number;
  /** Probability (0–1) that a single hit KOs the target from its current HP. Accuracy is NOT included. */
  koChance: number;
  /** True when the target is immune (type or ability). */
  immune: boolean;
  /** Where the numbers came from. */
  source: 'calc' | 'fallback' | 'fixed' | 'none';
}

/** Evaluate a Pokémon as another forme (Mega Evolution preview). `ability` is a name or id. */
export interface FormeOverride {
  species: string;
  ability: string;
}

export interface DamageOptions {
  useZ?: boolean;
  attackerForme?: FormeOverride;
  defenderForme?: FormeOverride;
}

type CalcWeather = 'Sand' | 'Sun' | 'Rain' | 'Hail' | 'Snow' | 'Harsh Sunshine' | 'Heavy Rain' | 'Strong Winds';
type CalcTerrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';
type CalcStatus = 'slp' | 'psn' | 'brn' | 'frz' | 'par' | 'tox' | '';

const WEATHER_MAP: Record<string, CalcWeather> = {
  sandstorm: 'Sand',
  sunnyday: 'Sun',
  raindance: 'Rain',
  hail: 'Hail',
  snowscape: 'Snow',
  snow: 'Snow',
  desolateland: 'Harsh Sunshine',
  primordialsea: 'Heavy Rain',
  deltastream: 'Strong Winds',
};

const TERRAIN_MAP: Record<string, CalcTerrain> = {
  electricterrain: 'Electric',
  grassyterrain: 'Grassy',
  psychicterrain: 'Psychic',
  mistyterrain: 'Misty',
};

const STATUSES = new Set<string>(['slp', 'psn', 'brn', 'frz', 'par', 'tox']);

const MOLD_BREAKERS = new Set(['moldbreaker', 'teravolt', 'turboblaze']);
/** Moves whose resolved base power must be handed to the calc explicitly (see `DamageModel.compute`). */
const CALC_BASE_POWER_OVERRIDE = new Set(['return', 'frustration', 'naturalgift']);

function zero(source: DamageEstimate['source'], immune = false): DamageEstimate {
  return { min: 0, max: 0, minPct: 0, maxPct: 0, koChance: 0, immune, source };
}

export function abilityId(battle: Battle, nameOrId: string): string {
  return battle.dex.abilities.get(nameOrId).id;
}

/** Current (effective) ability id of a Pokémon, honouring a forme override. */
export function effectiveAbility(battle: Battle, p: Pokemon, forme?: FormeOverride): string {
  return forme ? abilityId(battle, forme.ability) : p.ability;
}

/** Current types, honouring a forme override. */
export function effectiveTypes(battle: Battle, p: Pokemon, forme?: FormeOverride): string[] {
  if (forme) {
    const species = battle.dex.species.get(forme.species);
    if (species.exists) return [...species.types];
  }
  return p.getTypes();
}

// ---- bench-safe accessors ----------------------------------------------------------------------------------
// The sim's `hasItem()`, `hasAbility()` and `isGrounded()` report "no item / no ability / grounded" for every
// INACTIVE Pokémon (gen ≥ 5: `ignoringItem()` / `ignoringAbility()` are true off the field). The AI evaluates
// bench candidates all the time, so read the raw fields for them and keep the sim's semantics (Gastro Acid,
// Embargo, Magic Room, Neutralizing Gas, Klutz…) for the active Pokémon.

/** Item id the Pokémon effectively holds (''/suppressed → ''). */
export function heldItem(p: Pokemon): string {
  if (!p.item) return '';
  if (p.isActive && p.ignoringItem()) return '';
  return p.item;
}

export function hasItemNow(p: Pokemon, id: string): boolean {
  return heldItem(p) === id;
}

/** Ability id the Pokémon effectively has ('' when suppressed). */
export function currentAbility(p: Pokemon): string {
  if (p.isActive && p.ignoringAbility()) return '';
  return p.ability;
}

export function hasAbilityNow(p: Pokemon, id: string): boolean {
  return currentAbility(p) === id;
}

/**
 * Grounded state usable for a bench Pokémon too: `true` grounded, `false` airborne (Flying / Air Balloon /
 * Magnet Rise / Telekinesis), `null` airborne through Levitate (bypassed by Mold Breaker, Gravity, Iron Ball…).
 */
export function isGroundedNow(p: Pokemon): boolean | null {
  if (p.isActive) return p.isGrounded();
  if ('gravity' in p.battle.field.pseudoWeather) return true;
  const item = heldItem(p);
  if (item === 'ironball') return true;
  if (p.hasType('Flying')) return false;
  const ability = currentAbility(p);
  if (ability === 'levitate' || ability === 'eelevate') return null;
  return item !== 'airballoon';
}

// ---- moves whose type / power depend on the user -----------------------------------------------------------

export interface ResolvedMove {
  /** Type the move will actually have when `user` uses it now. */
  type: string;
  /** Base power it will actually have (0 keeps the dex value / callback semantics). */
  basePower: number;
}

/**
 * Terrain-dependent move id Nature Power turns into (Tri Attack without terrain). Nature Power is a Status move
 * in the dex, so the AI evaluates the move it becomes instead.
 */
export function naturePowerMoveId(battle: Battle): string {
  switch (battle.field.terrain) {
    case 'electricterrain':
      return 'thunderbolt';
    case 'grassyterrain':
      return 'energyball';
    case 'mistyterrain':
      return 'moonblast';
    case 'psychicterrain':
      return 'psychic';
    default:
      return 'triattack';
  }
}

/** The dex move the AI should evaluate for a move slot (Nature Power → the move it calls). */
export function evaluatedMove(battle: Battle, moveId: string): Move {
  const move = battle.dex.moves.get(moveId);
  if (move.id === 'naturepower') return battle.dex.moves.get(naturePowerMoveId(battle));
  return move;
}

function weatherBallType(battle: Battle, user: Pokemon): string {
  const umbrella = hasItemNow(user, 'utilityumbrella');
  switch (battle.field.effectiveWeather()) {
    case 'sunnyday':
    case 'desolateland':
      return umbrella ? 'Normal' : 'Fire';
    case 'raindance':
    case 'primordialsea':
      return umbrella ? 'Normal' : 'Water';
    case 'sandstorm':
      return 'Rock';
    case 'hail':
    case 'snowscape':
    case 'snow':
      return 'Ice';
    default:
      return 'Normal';
  }
}

function terrainType(battle: Battle): string {
  switch (battle.field.terrain) {
    case 'electricterrain':
      return 'Electric';
    case 'grassyterrain':
      return 'Grass';
    case 'mistyterrain':
      return 'Fairy';
    case 'psychicterrain':
      return 'Psychic';
    default:
      return 'Normal';
  }
}

/**
 * Resolves the real type and base power of a user-dependent move (Hidden Power, Judgment, Multi-Attack,
 * Techno Blast, Weather Ball, Terrain Pulse, Revelation Dance, Ivy Cudgel, Raging Bull, Aura Wheel, Natural
 * Gift, Return/Frustration). Other moves keep their dex values. Tera Blast keeps Normal (Terastallization is
 * disabled in the battle formats).
 */
export function resolveMove(battle: Battle, move: Move, user: Pokemon, forme?: FormeOverride): ResolvedMove {
  const dexItem = () => battle.dex.items.get(heldItem(user));
  const speciesName = forme?.species ?? user.species.name;
  switch (move.id) {
    case 'hiddenpower':
      return { type: user.hpType || 'Dark', basePower: move.basePower || 60 };
    case 'judgment': {
      const item = dexItem();
      return { type: item.exists && item.onPlate && !item.zMove ? item.onPlate : 'Normal', basePower: move.basePower };
    }
    case 'multiattack': {
      const item = dexItem();
      return { type: item.exists && item.onMemory ? item.onMemory : 'Normal', basePower: move.basePower };
    }
    case 'technoblast': {
      const item = dexItem();
      return { type: item.exists && item.onDrive ? item.onDrive : 'Normal', basePower: move.basePower };
    }
    case 'weatherball': {
      const type = weatherBallType(battle, user);
      return { type, basePower: type === 'Normal' ? move.basePower : move.basePower * 2 };
    }
    case 'terrainpulse': {
      const type = terrainType(battle);
      const boosted = type !== 'Normal' && !!isGroundedNow(user);
      return { type, basePower: boosted ? move.basePower * 2 : move.basePower };
    }
    case 'revelationdance': {
      const types = effectiveTypes(battle, user, forme).filter((t) => t !== '???');
      return { type: types[0] ?? 'Normal', basePower: move.basePower };
    }
    case 'ivycudgel': {
      const type =
        speciesName === 'Ogerpon-Wellspring' || speciesName === 'Ogerpon-Wellspring-Tera' ? 'Water'
        : speciesName === 'Ogerpon-Hearthflame' || speciesName === 'Ogerpon-Hearthflame-Tera' ? 'Fire'
        : speciesName === 'Ogerpon-Cornerstone' || speciesName === 'Ogerpon-Cornerstone-Tera' ? 'Rock'
        : 'Grass';
      return { type, basePower: move.basePower };
    }
    case 'ragingbull': {
      const type =
        speciesName === 'Tauros-Paldea-Combat' ? 'Fighting'
        : speciesName === 'Tauros-Paldea-Blaze' ? 'Fire'
        : speciesName === 'Tauros-Paldea-Aqua' ? 'Water'
        : 'Normal';
      return { type, basePower: move.basePower };
    }
    case 'aurawheel':
      return { type: speciesName === 'Morpeko-Hangry' ? 'Dark' : 'Electric', basePower: move.basePower };
    case 'naturalgift': {
      const item = dexItem();
      if (item.exists && item.naturalGift) return { type: item.naturalGift.type, basePower: item.naturalGift.basePower };
      return { type: 'Normal', basePower: 0 };
    }
    case 'return':
      return { type: move.type, basePower: Math.floor((user.happiness * 10) / 25) || 1 };
    case 'frustration':
      return { type: move.type, basePower: Math.floor(((255 - user.happiness) * 10) / 25) || 1 };
    default:
      return { type: move.type, basePower: move.basePower };
  }
}

/** Type the move will have when `user` uses it now (see `resolveMove`). */
export function resolveMoveType(battle: Battle, move: Move, user: Pokemon, forme?: FormeOverride): string {
  return resolveMove(battle, move, user, forme).type;
}

/** Type effectiveness exponent (−2…2) of a move type against a defender. */
export function typeEffectiveness(battle: Battle, moveType: string, defender: Pokemon, forme?: FormeOverride): number {
  const types = effectiveTypes(battle, defender, forme);
  if (!battle.dex.getImmunity(moveType, types)) return -10;
  return battle.dex.getEffectiveness(moveType, types);
}

/**
 * Does the defender take no damage from this move (type or ability immunity)?
 * Status moves are not covered here (see evaluate.ts).
 */
export function isImmune(battle: Battle, move: Move, attacker: Pokemon, defender: Pokemon, opts: DamageOptions = {}): boolean {
  if (move.category === 'Status') return false;
  const atkAbility = effectiveAbility(battle, attacker, opts.attackerForme);
  const defAbility = effectiveAbility(battle, defender, opts.defenderForme);
  const defTypes = effectiveTypes(battle, defender, opts.defenderForme);
  const moldBreaker = MOLD_BREAKERS.has(atkAbility) || !!move.ignoreAbility;
  const moveType = resolveMoveType(battle, move, attacker, opts.attackerForme);
  const ignoresTypeImmunity =
    move.ignoreImmunity === true ||
    (typeof move.ignoreImmunity === 'object' && move.ignoreImmunity !== null && !!(move.ignoreImmunity as Record<string, boolean>)[moveType]);

  if (!ignoresTypeImmunity) {
    if (moveType === 'Ground' && move.id !== 'thousandarrows') {
      const grounded = isGroundedNow(defender);
      if (grounded === null && !moldBreaker) return true; // Levitate
      // Flying type / Magnet Rise / Air Balloon / Telekinesis: not bypassed by Mold Breaker.
      if (grounded === false) return true;
    } else if (!battle.dex.getImmunity(moveType, defTypes)) {
      const ghostException =
        defTypes.includes('Ghost') &&
        (moveType === 'Normal' || moveType === 'Fighting') &&
        (atkAbility === 'scrappy' || atkAbility === 'mindseye' || !!defender.volatiles['foresight']);
      const darkException = defTypes.includes('Dark') && moveType === 'Psychic' && !!defender.volatiles['miracleeye'];
      if (!ghostException && !darkException) return true;
    }
  }

  if (!moldBreaker) {
    const t = moveType;
    switch (defAbility) {
      case 'flashfire':
      case 'wellbakedbody':
        if (t === 'Fire') return true;
        break;
      case 'waterabsorb':
      case 'dryskin':
      case 'stormdrain':
        if (t === 'Water') return true;
        break;
      case 'voltabsorb':
      case 'lightningrod':
      case 'motordrive':
        if (t === 'Electric') return true;
        break;
      case 'sapsipper':
        if (t === 'Grass') return true;
        break;
      case 'eartheater':
        if (t === 'Ground') return true;
        break;
      case 'windrider':
        if (move.flags.wind) return true;
        break;
      case 'soundproof':
        if (move.flags.sound) return true;
        break;
      case 'bulletproof':
        if (move.flags.bullet) return true;
        break;
      case 'wonderguard':
        if (battle.dex.getEffectiveness(moveType, defTypes) <= 0) return true;
        break;
      case 'dazzling':
      case 'queenlymajesty':
      case 'armortail':
        if (move.priority > 0) return true;
        break;
      default:
        break;
    }
  }
  if (move.priority > 0 && battle.field.terrain === 'psychicterrain' && isGroundedNow(defender)) return true;
  return false;
}

const BOOST_TABLE = [1, 4 / 3, 5 / 3, 2, 7 / 3, 8 / 3, 3];

type BattleStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

/**
 * Effective (boosted + modified) stat that is safe to read outside of a move.
 *
 * `pokemon.getStat(stat)` fires the sim's `ModifyAtk`/`ModifySpA`/… events with a null move and handlers such
 * as Blaze or Flash Fire dereference `move.type`, so it must never be called from the AI. Speed has no such
 * handlers and is read with modifiers; the other stats are read boosted-but-unmodified and the common item,
 * ability, status and weather modifiers are applied by hand.
 */
export function effectiveStat(p: Pokemon, stat: BattleStat): number {
  if (stat === 'spe') return p.getStat('spe');
  let value = p.getStat(stat, false, true);
  const ability = p.ability;
  const item = p.item;
  const weather = p.battle.field.effectiveWeather();
  const sun = weather === 'sunnyday' || weather === 'desolateland';
  const nfe = p.species.nfe;
  switch (stat) {
    case 'atk':
      if (ability === 'hugepower' || ability === 'purepower') value *= 2;
      if (ability === 'guts' && p.status) value *= 1.5;
      if (ability === 'hustle') value *= 1.5;
      if (ability === 'gorillatactics') value *= 1.5;
      if (ability === 'slowstart' && p.activeTurns < 5) value *= 0.5;
      if (ability === 'flowergift' && sun) value *= 1.5;
      if (p.status === 'brn' && ability !== 'guts') value *= 0.5;
      if (item === 'choiceband') value *= 1.5;
      if (item === 'thickclub' && (p.species.id === 'cubone' || p.species.baseSpecies === 'Marowak')) value *= 2;
      if (item === 'lightball' && p.species.baseSpecies === 'Pikachu') value *= 2;
      break;
    case 'spa':
      if (ability === 'solarpower' && sun) value *= 1.5;
      if (item === 'choicespecs') value *= 1.5;
      if (item === 'lightball' && p.species.baseSpecies === 'Pikachu') value *= 2;
      if (item === 'deepseatooth' && p.species.id === 'clamperl') value *= 2;
      break;
    case 'def':
      if (ability === 'furcoat') value *= 2;
      if (ability === 'marvelscale' && p.status) value *= 1.5;
      if (ability === 'grasspelt' && p.battle.field.terrain === 'grassyterrain') value *= 1.5;
      if (item === 'eviolite' && nfe) value *= 1.5;
      if ((weather === 'snowscape' || weather === 'snow' || weather === 'hail') && p.hasType('Ice')) value *= 1.5;
      break;
    case 'spd':
      if (ability === 'flowergift' && sun) value *= 1.5;
      if (item === 'eviolite' && nfe) value *= 1.5;
      if (item === 'assaultvest') value *= 1.5;
      if (item === 'deepseascale' && p.species.id === 'clamperl') value *= 2;
      if (weather === 'sandstorm' && p.hasType('Rock')) value *= 1.5;
      break;
    default:
      break;
  }
  return Math.max(1, Math.floor(value));
}

/** Probability (0–1) that the move connects. */
export function hitChance(battle: Battle, move: Move, attacker: Pokemon, defender: Pokemon, opts: DamageOptions = {}): number {
  const atkAbility = effectiveAbility(battle, attacker, opts.attackerForme);
  const defAbility = effectiveAbility(battle, defender, opts.defenderForme);
  if (atkAbility === 'noguard' || defAbility === 'noguard') return 1;
  if (defender.volatiles['minimize'] && move.flags.contact && ['bodyslam', 'stomp', 'dragonrush', 'heatcrash', 'heavyslam', 'flyingpress', 'maliciousmoonsault', 'supercellslam'].includes(move.id)) return 1;
  if (move.ohko) {
    if (defender.level > attacker.level) return 0;
    if (defAbility === 'sturdy' && !MOLD_BREAKERS.has(atkAbility)) return 0;
    if (move.id === 'sheercold' && defender.hasType('Ice')) return 0;
    const base = move.id === 'sheercold' && !attacker.hasType('Ice') ? 20 : 30;
    return Math.min(1, (base + attacker.level - defender.level) / 100);
  }
  const weather = battle.field.effectiveWeather();
  if (move.accuracy === true) return 1;
  let acc = move.accuracy;
  if (move.id === 'thunder' || move.id === 'hurricane') {
    if (weather === 'raindance' || weather === 'primordialsea') return 1;
    if (weather === 'sunnyday' || weather === 'desolateland') acc = 50;
  }
  if (move.id === 'blizzard' && (weather === 'hail' || weather === 'snowscape' || weather === 'snow')) return 1;
  if (move.id === 'toxic' && attacker.hasType('Poison')) return 1;
  if (move.target === 'self' || move.target === 'allySide' || move.target === 'foeSide' || move.target === 'all') return 1;

  let mult = 1;
  if (atkAbility === 'compoundeyes') mult *= 1.3;
  if (atkAbility === 'victorystar') mult *= 1.1;
  if (atkAbility === 'hustle' && move.category === 'Physical') mult *= 0.8;
  if (hasItemNow(attacker, 'widelens')) mult *= 1.1;
  if (hasItemNow(attacker, 'zoomlens') && attacker.getActionSpeed() < defender.getActionSpeed()) mult *= 1.2;
  if (hasItemNow(defender, 'brightpowder') || hasItemNow(defender, 'laxincense')) mult *= 0.9;
  if (defAbility === 'sandveil' && weather === 'sandstorm') mult *= 0.8;
  if (defAbility === 'snowcloak' && (weather === 'hail' || weather === 'snowscape' || weather === 'snow')) mult *= 0.8;
  if (defAbility === 'tangledfeet' && defender.volatiles['confusion']) mult *= 0.5;
  if (battle.field.getPseudoWeather('gravity')) mult *= 5 / 3;

  let stages = attacker.boosts.accuracy ?? 0;
  const ignoresEvasion = atkAbility === 'keeneye' || atkAbility === 'illuminate' || atkAbility === 'mindseye' || !!defender.volatiles['foresight'] || !!defender.volatiles['miracleeye'];
  if (!ignoresEvasion && defAbility !== 'unaware') stages -= defender.boosts.evasion ?? 0;
  stages = Math.max(-6, Math.min(6, stages));
  const stageMult = stages >= 0 ? BOOST_TABLE[stages] : 1 / BOOST_TABLE[-stages];
  return Math.max(0, Math.min(1, (acc / 100) * mult * stageMult));
}

function toCalcStatus(status: string): CalcStatus {
  return STATUSES.has(status) ? (status as CalcStatus) : '';
}

/** Species name the calc knows: cosmetic formes (Vivillon-Archipelago, Gastrodon-East, …) map to their base species. */
function calcSpeciesName(battle: Battle, name: string): string {
  if (GEN.species.get(battle.dex.toID(name))) return name;
  const species = battle.dex.species.get(name);
  if (species.exists && species.baseSpecies !== name && GEN.species.get(battle.dex.toID(species.baseSpecies))) return species.baseSpecies;
  return name;
}

function toCalcPokemon(battle: Battle, p: Pokemon, forme?: FormeOverride): CalcPokemon {
  const speciesName = calcSpeciesName(battle, forme?.species ?? p.species.name);
  const abilityName = forme ? battle.dex.abilities.get(forme.ability).name : battle.dex.abilities.get(p.ability).name;
  const itemName = p.item ? battle.dex.items.get(p.item).name : undefined;
  const set = p.set;
  const boosts = {
    atk: p.boosts.atk ?? 0,
    def: p.boosts.def ?? 0,
    spa: p.boosts.spa ?? 0,
    spd: p.boosts.spd ?? 0,
    spe: p.boosts.spe ?? 0,
  };
  return new CalcPokemon(GEN, speciesName, {
    level: p.level,
    ability: abilityName,
    item: itemName,
    nature: set.nature || undefined,
    evs: set.evs ?? undefined,
    ivs: set.ivs ?? undefined,
    boosts,
    curHP: Math.max(1, p.hp),
    status: toCalcStatus(p.status),
    gender: p.gender === 'M' || p.gender === 'F' ? p.gender : 'N',
    toxicCounter: p.status === 'tox' ? Math.max(1, Number(p.statusState?.stage ?? 1)) : 0,
  });
}

function toCalcField(battle: Battle, attacker: Pokemon, defender: Pokemon): CalcField {
  const weather = WEATHER_MAP[battle.field.effectiveWeather()];
  const terrain = TERRAIN_MAP[battle.field.terrain];
  const sideFor = (p: Pokemon, isDefender: boolean) => {
    const sc = p.side.sideConditions;
    return {
      isReflect: !!sc['reflect'],
      isLightScreen: !!sc['lightscreen'],
      isAuroraVeil: !!sc['auroraveil'],
      isTailwind: !!sc['tailwind'],
      isSR: !!sc['stealthrock'],
      spikes: Number(sc['spikes']?.layers ?? 0),
      isSeeded: isDefender ? !!p.volatiles['leechseed'] : false,
      isForesight: isDefender ? !!p.volatiles['foresight'] : false,
    };
  };
  return new CalcField({
    gameType: 'Singles',
    weather,
    terrain,
    isGravity: !!battle.field.getPseudoWeather('gravity'),
    isMagicRoom: !!battle.field.getPseudoWeather('magicroom'),
    isWonderRoom: !!battle.field.getPseudoWeather('wonderroom'),
    attackerSide: sideFor(attacker, false),
    defenderSide: sideFor(defender, true),
  });
}

function koChanceFromRolls(damage: number | number[] | number[][] | null, hp: number, min: number, max: number): number {
  if (hp <= 0) return 1;
  if (min >= hp) return 1;
  if (max < hp) return 0;
  if (Array.isArray(damage) && damage.length > 2 && typeof damage[0] === 'number') {
    const rolls = damage as number[];
    return rolls.filter((d) => d >= hp).length / rolls.length;
  }
  return (max - hp + 1) / (max - min + 1);
}

function zBasePower(move: Move): number {
  if (move.zMove?.basePower) return move.zMove.basePower;
  const bp = move.basePower;
  if (bp <= 55) return 100;
  if (bp <= 65) return 120;
  if (bp <= 75) return 140;
  if (bp <= 85) return 160;
  if (bp <= 95) return 175;
  if (bp <= 100) return 180;
  if (bp <= 110) return 185;
  if (bp <= 125) return 190;
  if (bp <= 130) return 195;
  return 200;
}

/**
 * Simple damage formula used when the calc throws (or for hypothetical moves). Returns [min, max] HP.
 * `move.type` / `move.basePower` must already be resolved for the user (see `resolveMove`).
 */
export function fallbackDamage(
  battle: Battle,
  attacker: Pokemon,
  defender: Pokemon,
  move: { type: string; category: 'Physical' | 'Special' | 'Status'; basePower: number; overrideOffensiveStat?: string; overrideDefensiveStat?: string },
  opts: DamageOptions = {},
): [number, number] {
  if (move.category === 'Status') return [0, 0];
  const bp = move.basePower > 0 ? move.basePower : 60;
  const physical = move.category === 'Physical';
  const atkStatName = (move.overrideOffensiveStat ?? (physical ? 'atk' : 'spa')) as 'atk' | 'spa' | 'def' | 'spd';
  const defStatName = (move.overrideDefensiveStat ?? (physical ? 'def' : 'spd')) as 'def' | 'spd';
  const atk = effectiveStat(attacker, atkStatName);
  const def = Math.max(1, effectiveStat(defender, defStatName));
  const atkAbility = effectiveAbility(battle, attacker, opts.attackerForme);
  const atkTypes = effectiveTypes(battle, attacker, opts.attackerForme);
  const stab = atkTypes.includes(move.type) ? (atkAbility === 'adaptability' ? 2 : 1.5) : 1;
  const effExp = typeEffectiveness(battle, move.type, defender, opts.defenderForme);
  if (effExp <= -10) return [0, 0];
  const eff = Math.pow(2, effExp);
  const base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * bp * atk) / def) / 50) + 2;
  const max = Math.floor(base * stab * eff);
  const min = Math.floor(base * 0.85 * stab * eff);
  return [Math.max(0, min), Math.max(0, max)];
}

export class DamageModel {
  private readonly cache = new Map<string, DamageEstimate>();

  constructor(readonly battle: Battle) {}

  /** Estimate the damage `attacker` deals to `defender` with the move `moveId` (a sim move id or name). */
  estimate(attacker: Pokemon, defender: Pokemon, moveId: string, opts: DamageOptions = {}): DamageEstimate {
    const key = [
      attacker.side.id,
      attacker.position,
      attacker.hp,
      defender.side.id,
      defender.position,
      defender.hp,
      moveId,
      opts.useZ ? 'z' : '',
      opts.attackerForme?.species ?? '',
      opts.defenderForme?.species ?? '',
    ].join('|');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const result = this.compute(attacker, defender, moveId, opts);
    this.cache.set(key, result);
    return result;
  }

  /** Damage of a hypothetical move (e.g. a generic 80 BP STAB move) using the fallback formula. */
  estimateVirtual(attacker: Pokemon, defender: Pokemon, type: string, category: 'Physical' | 'Special', basePower: number, opts: DamageOptions = {}): DamageEstimate {
    if (defender.hp <= 0) return zero('none');
    const [min, max] = fallbackDamage(this.battle, attacker, defender, { type, category, basePower }, opts);
    if (max <= 0) return zero('fallback', true);
    return this.finish(min, max, null, defender.hp, 'fallback');
  }

  private compute(attacker: Pokemon, defender: Pokemon, moveId: string, opts: DamageOptions): DamageEstimate {
    const battle = this.battle;
    const move = evaluatedMove(battle, moveId);
    if (!move.exists || move.category === 'Status') return zero('none');
    if (defender.hp <= 0) return zero('none');
    if (isImmune(battle, move, attacker, defender, opts)) return zero('fixed', true);
    const resolved = resolveMove(battle, move, attacker, opts.attackerForme);
    if (move.id === 'naturalgift' && resolved.basePower <= 0) return zero('none');

    const hp = defender.hp;
    // Fixed-damage moves: exact and cheap.
    if (move.ohko) return this.finish(hp, hp, null, hp, 'fixed');
    if (move.damage === 'level') return this.finish(attacker.level, attacker.level, null, hp, 'fixed');
    if (typeof move.damage === 'number') return this.finish(move.damage, move.damage, null, hp, 'fixed');
    switch (move.id) {
      case 'superfang':
      case 'naturesmadness':
      case 'ruination': {
        const d = Math.max(1, Math.floor(hp / 2));
        return this.finish(d, d, null, hp, 'fixed');
      }
      case 'finalgambit':
        return this.finish(attacker.hp, attacker.hp, null, hp, 'fixed');
      case 'endeavor': {
        const d = Math.max(0, hp - attacker.hp);
        return this.finish(d, d, null, hp, 'fixed');
      }
      case 'counter':
      case 'mirrorcoat':
      case 'metalburst':
      case 'comeuppance':
      case 'bide':
      case 'shellsidearm':
        if (move.id !== 'shellsidearm') return zero('none');
        break;
      default:
        break;
    }

    try {
      const atk = toCalcPokemon(battle, attacker, opts.attackerForme);
      const def = toCalcPokemon(battle, defender, opts.defenderForme);
      // The calc resolves Weather Ball / Judgment / Multi-Attack / … (type and power) itself from the same inputs,
      // so a type override is a harmless no-op for them and matters for Hidden Power (typed by the user's IVs) and
      // Natural Gift. Base power is only overridden where the calc has no rule of its own (it assumes max
      // happiness for Return AND Frustration, and doubles Weather Ball / Terrain Pulse internally).
      const overrides: CalcMoveOverrides = {
        ...(resolved.type !== move.type ? { type: resolved.type as CalcMoveOverrides['type'] } : {}),
        ...(CALC_BASE_POWER_OVERRIDE.has(move.id) && !opts.useZ ? { basePower: resolved.basePower } : {}),
      };
      const calcMove = new CalcMove(GEN, move.name, { useZ: !!opts.useZ, overrides });
      const field = toCalcField(battle, attacker, defender);
      const result = calculate(GEN, atk, def, calcMove, field);
      const [min, max] = result.range();
      if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('non-finite damage');
      if (max <= 0) return zero('calc', true);
      return this.finish(min, max, result.damage, hp, 'calc');
    } catch {
      let bp = resolved.basePower;
      if (opts.useZ) bp = zBasePower(move);
      const [min, max] = fallbackDamage(battle, attacker, defender, { ...move, type: resolved.type, basePower: bp }, opts);
      if (max <= 0) return zero('fallback', true);
      return this.finish(min, max, null, hp, 'fallback');
    }
  }

  private finish(min: number, max: number, rolls: number | number[] | number[][] | null, hp: number, source: DamageEstimate['source']): DamageEstimate {
    const safeHp = Math.max(1, hp);
    return {
      min,
      max,
      minPct: (min / safeHp) * 100,
      maxPct: (max / safeHp) * 100,
      koChance: koChanceFromRolls(rolls, hp, min, max),
      immune: false,
      source,
    };
  }
}
