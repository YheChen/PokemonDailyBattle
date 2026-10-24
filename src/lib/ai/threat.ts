/**
 * Shared helpers for the opponent AI: evaluation environment, speed ordering and "threat" analysis
 * (what is the best thing one Pokémon can do to another this turn).
 */
import type { Battle, Move, Pokemon, PRNG, Side } from '@pkmn/sim';
import type { Difficulty } from '@/lib/battle/types';
import { DamageModel, effectiveAbility, effectiveStat, effectiveTypes, evaluatedMove, hasItemNow, hitChance, type FormeOverride } from './damage';

export interface Env {
  battle: Battle;
  side: Side;
  dmg: DamageModel;
  difficulty: Difficulty;
  prng: PRNG;
}

export interface Threat {
  /** Best damaging move id (null when the attacker has no damaging option). */
  moveId: string | null;
  /** Accuracy-weighted expected damage as % of the defender's *current* HP (each move capped at 100). */
  expectedPct: number;
  /** Max roll of the best move as % of the defender's current HP (not accuracy weighted, uncapped). */
  maxPct: number;
  /** Accuracy-weighted probability that the best move KOs the defender this turn. */
  koChance: number;
  /** Priority of the best move. */
  priority: number;
  /** Category of the best move. */
  category: 'Physical' | 'Special' | null;
  /** Accuracy-weighted expected damage of the best move as % of the defender's *max* HP. */
  expectedPctOfMax: number;
  /** Share of the attacker's damaging moves that are physical (0–1). */
  physicalShare: number;
  /** Does the attacker have any damaging move at all? */
  hasDamaging: boolean;
}

export const NO_THREAT: Threat = {
  moveId: null,
  expectedPct: 0,
  maxPct: 0,
  koChance: 0,
  priority: 0,
  category: null,
  expectedPctOfMax: 0,
  physicalShare: 0.5,
  hasDamaging: false,
};

export function hpPct(p: Pokemon): number {
  return p.maxhp > 0 ? (p.hp / p.maxhp) * 100 : 0;
}

export function alive(p: Pokemon | null | undefined): p is Pokemon {
  return !!p && p.hp > 0 && !p.fainted;
}

export function isDamagingMove(move: Move): boolean {
  return move.category !== 'Status';
}

/** The foe Pokémon the AI should reason about: the active one if it is alive, otherwise the first alive bench member. */
export function pickFoe(side: Side): Pokemon | null {
  const foe = side.foe;
  if (!foe) return null;
  const active = foe.active[0];
  if (alive(active)) return active;
  return foe.pokemon.find((p) => alive(p)) ?? active ?? null;
}

/** Probability that `me` acts before `foe` when both use moves of equal priority. */
export function speedOrderProb(me: Pokemon, foe: Pokemon): number {
  const a = me.getActionSpeed();
  const b = foe.getActionSpeed();
  if (a > b) return 1;
  if (a < b) return 0;
  return 0.5;
}

/** Priority of a move when used by `user` (Prankster, Gale Wings, Triage). */
export function effectivePriority(env: Env, user: Pokemon, move: Move, forme?: FormeOverride): number {
  let p = move.priority;
  const ability = effectiveAbility(env.battle, user, forme);
  if (ability === 'prankster' && move.category === 'Status') p += 1;
  if (ability === 'galewings' && move.type === 'Flying' && user.hp === user.maxhp) p += 1;
  if (ability === 'triage' && move.flags.heal) p += 3;
  return p;
}

/** Probability that `me` (using a move of priority `myPrio`) acts before `foe` (using priority `foePrio`). */
export function movesFirstProb(me: Pokemon, foe: Pokemon, myPrio: number, foePrio: number): number {
  if (myPrio > foePrio) return 1;
  if (myPrio < foePrio) return 0;
  return speedOrderProb(me, foe);
}

export interface ThreatOptions {
  attackerForme?: FormeOverride;
  defenderForme?: FormeOverride;
  /** Also consider generic 80 BP STAB moves (what an unknown set could carry). Default true. */
  includeStab?: boolean;
}

/** Best damaging option `attacker` has against `defender` right now. */
export function analyzeThreat(env: Env, attacker: Pokemon, defender: Pokemon, opts: ThreatOptions = {}): Threat {
  const { battle, dmg } = env;
  if (!alive(attacker) || !alive(defender)) return NO_THREAT;
  const includeStab = opts.includeStab ?? true;
  const dmgOpts = { attackerForme: opts.attackerForme, defenderForme: opts.defenderForme };

  let best: Threat = { ...NO_THREAT };
  let bestValue = -1;
  let physical = 0;
  let damaging = 0;

  const consider = (
    moveId: string | null,
    expectedPct: number,
    maxPct: number,
    koChance: number,
    priority: number,
    category: 'Physical' | 'Special',
    expectedPctOfMax: number,
  ) => {
    const value = expectedPct + koChance * 50;
    if (value > bestValue) {
      bestValue = value;
      best = { moveId, expectedPct, maxPct, koChance, priority, category, expectedPctOfMax, physicalShare: 0.5, hasDamaging: true };
    }
  };

  for (const slot of attacker.moveSlots) {
    if (slot.pp <= 0 && slot.maxpp > 0) continue;
    const move = evaluatedMove(battle, slot.id);
    if (!move.exists || !isDamagingMove(move)) continue;
    damaging++;
    if (move.category === 'Physical') physical++;
    if ((move.id === 'fakeout' || move.id === 'firstimpression') && attacker.activeMoveActions >= 1) continue;
    if (move.id === 'dreameater' && defender.status !== 'slp') continue;
    const est = dmg.estimate(attacker, defender, move.id, dmgOpts);
    if (est.immune || est.max <= 0) continue;
    const acc = hitChance(battle, move, attacker, defender, dmgOpts);
    let factor = acc;
    if (move.flags.charge && !hasItemNow(attacker, 'powerherb')) factor *= 0.55;
    if (move.flags.recharge) factor *= 0.8;
    if (move.id === 'suckerpunch' || move.id === 'thunderclap') factor *= 0.7;
    if (move.id === 'futuresight' || move.id === 'doomdesire') factor *= 0.5;
    if (move.selfdestruct) factor *= 0.5;
    const avgPct = Math.min(100, (est.minPct + est.maxPct) / 2);
    const avgOfMax = defender.maxhp > 0 ? ((est.min + est.max) / 2 / defender.maxhp) * 100 : 0;
    const category: 'Physical' | 'Special' = move.category === 'Physical' ? 'Physical' : 'Special';
    consider(move.id, avgPct * factor, est.maxPct, est.koChance * factor, move.priority, category, avgOfMax * factor);
  }

  if (includeStab) {
    // Generic STAB coverage: a hypothetical 80 BP move of each of the attacker's types.
    const atkStat = effectiveStat(attacker, 'atk');
    const spaStat = effectiveStat(attacker, 'spa');
    const category: 'Physical' | 'Special' = atkStat >= spaStat ? 'Physical' : 'Special';
    for (const type of effectiveTypes(battle, attacker, opts.attackerForme)) {
      if (type === '???' || type === 'Stellar') continue;
      const est = dmg.estimateVirtual(attacker, defender, type, category, 80, dmgOpts);
      if (est.immune || est.max <= 0) continue;
      const factor = 0.85;
      const avgPct = Math.min(100, (est.minPct + est.maxPct) / 2);
      const avgOfMax = defender.maxhp > 0 ? ((est.min + est.max) / 2 / defender.maxhp) * 100 : 0;
      consider(null, avgPct * factor, est.maxPct * 0.9, est.koChance * factor, 0, category, avgOfMax * factor);
    }
  }

  const physicalShare = damaging > 0 ? physical / damaging : effectiveStat(attacker, 'atk') >= effectiveStat(attacker, 'spa') ? 1 : 0;
  return { ...best, physicalShare, hasDamaging: damaging > 0 || (includeStab && bestValue > 0) };
}

/** Count of a Pokémon's known status moves. */
export function statusMoveCount(battle: Battle, p: Pokemon): number {
  return p.moveSlots.filter((s) => {
    const m = battle.dex.moves.get(s.id);
    return m.exists && m.category === 'Status';
  }).length;
}

export function hasMove(p: Pokemon, ids: readonly string[]): boolean {
  return p.moveSlots.some((s) => ids.includes(s.id));
}

export const SETUP_IDS: readonly string[] = [
  'swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'quiverdance', 'bulkup', 'irondefense', 'shellsmash', 'agility', 'coil', 'curse',
  'bellydrum', 'workup', 'growth', 'honeclaws', 'tailglow', 'shiftgear', 'rockpolish', 'autotomize', 'amnesia', 'cosmicpower', 'victorydance',
  'clangoroussoul', 'noretreat', 'filletaway', 'geomancy', 'takeheart', 'cottonguard', 'acidarmor', 'barrier', 'stockpile', 'tidyup', 'howl',
  'meditate', 'sharpen', 'defendorder', 'minimize', 'doubleteam', 'charge', 'focusenergy',
];
export const RECOVERY_IDS: readonly string[] = [
  'recover', 'roost', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'softboiled', 'milkdrink', 'shoreup', 'wish', 'rest', 'strengthsap',
  'healorder', 'painsplit', 'lifedew', 'junglehealing', 'lunarblessing', 'swallow',
];
export const HAZARD_REMOVAL_IDS: readonly string[] = ['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange'];
export const PHAZE_IDS: readonly string[] = ['haze', 'clearsmog', 'roar', 'whirlwind', 'dragontail', 'circlethrow', 'topsyturvy', 'spectralthief'];
export const PROTECT_IDS: readonly string[] = ['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'obstruct', 'silktrap', 'burningbulwark', 'maxguard'];

/** Sum of positive stat boosts. */
export function positiveBoostSum(p: Pokemon): number {
  let sum = 0;
  for (const stat of ['atk', 'def', 'spa', 'spd', 'spe'] as const) sum += Math.max(0, p.boosts[stat] ?? 0);
  return sum;
}

/** Layers of hazards on a side (Stealth Rock counts as 1). */
export function hazardLayers(side: Side): number {
  const sc = side.sideConditions;
  let n = 0;
  if (sc['stealthrock']) n += 1;
  if (sc['spikes']) n += Number(sc['spikes'].layers ?? 1);
  if (sc['toxicspikes']) n += Number(sc['toxicspikes'].layers ?? 1);
  if (sc['stickyweb']) n += 1;
  if (sc['gmaxsteelsurge']) n += 1;
  return n;
}

/** Sleep Clause Mod: a sleep move fails when a foe is already asleep from an opposing source. */
export function sleepClauseBlocks(targetSide: Side): boolean {
  return targetSide.pokemon.some((p) => {
    if (p.hp <= 0 || p.status !== 'slp') return false;
    const source = p.statusState?.source as Pokemon | null | undefined;
    return !(source && source.isAlly(p));
  });
}
