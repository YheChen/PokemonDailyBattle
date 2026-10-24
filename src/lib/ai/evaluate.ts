/**
 * Action evaluation for the opponent AI.
 *
 * `scoreActions(ctx)` scores every legal choice for the current request. Scores live roughly on a
 * "percent of the foe's HP" scale: a move that deals 50 % scores about 50, a KO adds a large bonus,
 * good status moves land in the 40–80 range, useless or immune options go negative.
 */
import type { Move, Pokemon, Side } from '@pkmn/sim';
import type { AIContext, Difficulty, MoveRequest } from '@/lib/battle/types';
import { isRevivingRequest, listLegalChoices } from '@/lib/battle/legal';
import { DamageModel, effectiveAbility, effectiveStat, evaluatedMove, hitChance, isImmune, resolveMoveType, typeEffectiveness, type FormeOverride } from './damage';
import { scoreForcedSwitches, scoreRevivalTargets, scoreVoluntarySwitches, type SwitchCandidate } from './matchup';
import {
  HAZARD_REMOVAL_IDS,
  NO_THREAT,
  PHAZE_IDS,
  PROTECT_IDS,
  RECOVERY_IDS,
  SETUP_IDS,
  alive,
  analyzeThreat,
  effectivePriority,
  hasMove,
  hazardLayers,
  hpPct,
  movesFirstProb,
  pickFoe,
  positiveBoostSum,
  sleepClauseBlocks,
  speedOrderProb,
  statusMoveCount,
  type Env,
  type Threat,
} from './threat';

export interface ScoredAction {
  /** Showdown choice string, e.g. "move 2", "move 1 mega", "switch 3". */
  choice: string;
  score: number;
  kind: 'move' | 'switch' | 'pass' | 'team';
  /** Human-readable reasoning (for debugging / tests). */
  detail: string;
}

export interface MoveEval {
  score: number;
  detail: string;
  priority: number;
  koChance: number;
  immune: boolean;
  /** Setup / hazards / screens / weather: value accrues over future turns. */
  longTerm: boolean;
  recovery: boolean;
  protect: boolean;
  pivot: boolean;
}

interface MoveContext {
  me: Pokemon;
  foe: Pokemon;
  /** Foe's best option vs. the (possibly mega-evolved) active Pokémon. */
  threat: Threat;
  /** Active Pokémon's best damaging option vs. the foe. */
  myThreat: Threat;
  forme?: FormeOverride;
  useZ?: boolean;
}

const MEGA_BONUS = 8;
const NEVER = -1000;
const KO_BONUS = 60;

const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'allAdjacent', 'foeSide', 'randomNormal', 'scripted']);
const STAT_DROP_IMMUNE = new Set(['clearbody', 'whitesmoke', 'fullmetalbody', 'mirrorarmor', 'contrary', 'defiant', 'competitive']);
const CHOICE_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf']);
const BAD_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf', 'assaultvest', 'flameorb', 'toxicorb', 'ironball', 'laggingtail', 'stickybarb', 'ringtarget']);
const USELESS_STATUS = new Set([
  'splash', 'celebrate', 'holdhands', 'teatime', 'happyhour', 'helpinghand', 'followme', 'ragepowder', 'allyswitch', 'aromaticmist', 'coaching', 'decorate',
  'instruct', 'quash', 'afteryou', 'spotlight', 'wideguard', 'quickguard', 'matblock', 'craftyshield', 'sketch', 'healpulse', 'floralhealing', 'flowershield',
  'gearup', 'magneticflux', 'rototiller', 'bestow', 'conversion2',
]);

function targetsFoe(move: Move): boolean {
  return FOE_TARGETS.has(move.target);
}

function blank(score: number, detail: string, extra: Partial<MoveEval> = {}): MoveEval {
  return { score, detail, priority: 0, koChance: 0, immune: false, longTerm: false, recovery: false, protect: false, pivot: false, ...extra };
}

function isSun(env: Env): boolean {
  const w = env.battle.field.effectiveWeather();
  return w === 'sunnyday' || w === 'desolateland';
}
function isRain(env: Env): boolean {
  const w = env.battle.field.effectiveWeather();
  return w === 'raindance' || w === 'primordialsea';
}
function isSnow(env: Env): boolean {
  const w = env.battle.field.effectiveWeather();
  return w === 'hail' || w === 'snowscape' || w === 'snow';
}
function isSand(env: Env): boolean {
  return env.battle.field.effectiveWeather() === 'sandstorm';
}

function weatherHurts(env: Env, p: Pokemon): boolean {
  if (p.hasAbility('magicguard') || p.hasAbility('overcoat') || p.hasItem('safetygoggles')) return false;
  if (isSand(env)) return !(p.hasType('Rock') || p.hasType('Ground') || p.hasType('Steel') || p.hasAbility('sandrush') || p.hasAbility('sandforce') || p.hasAbility('sandveil'));
  return false;
}

function residualDamage(env: Env, p: Pokemon): number {
  // Rough per-turn passive damage the foe suffers (score units).
  let r = 0;
  if (p.status === 'tox') r += 25;
  else if (p.status === 'psn' || p.status === 'brn') r += 15;
  if (p.volatiles['leechseed']) r += 15;
  if (p.volatiles['curse']) r += 25;
  if (p.volatiles['saltcure']) r += 15;
  if (p.volatiles['perishsong']) r += 20;
  if (p.volatiles['partiallytrapped']) r += 10;
  if (weatherHurts(env, p)) r += 8;
  return r;
}

/** Can `foe` receive status `status` from `me` using `move`? */
export function canBeStatused(env: Env, me: Pokemon, foe: Pokemon, status: string, move: Move, forme?: FormeOverride): boolean {
  const { battle } = env;
  if (!alive(foe)) return false;
  if (foe.status) return false;
  const myAbility = effectiveAbility(battle, me, forme);
  const moldBreaker = myAbility === 'moldbreaker' || myAbility === 'teravolt' || myAbility === 'turboblaze';
  const direct = move.category === 'Status';
  const bypassesSub = !!move.flags.bypasssub || !!move.flags.sound || myAbility === 'infiltrator';
  if (foe.volatiles['substitute'] && !bypassesSub) return false;
  if (direct && myAbility === 'prankster' && foe.hasType('Dark')) return false;
  if (direct && foe.hasAbility('magicbounce') && move.flags.reflectable && !moldBreaker) return false;
  if (direct && foe.hasAbility('goodasgold')) return false;
  if (move.flags.powder && (foe.hasType('Grass') || foe.hasAbility('overcoat') || foe.hasItem('safetygoggles'))) return false;
  const corrosion = myAbility === 'corrosion' && (status === 'psn' || status === 'tox');
  if (!corrosion && !battle.dex.getImmunity(status, foe.getTypes())) return false;
  if (status === 'par' && move.type === 'Electric' && move.ignoreImmunity === false && !battle.dex.getImmunity('Electric', foe.getTypes())) return false;
  if (!moldBreaker) {
    const a = foe.ability;
    if (a === 'comatose' || a === 'purifyingsalt' || a === 'shieldsdown' || (a === 'leafguard' && isSun(env))) return false;
    if (status === 'par' && a === 'limber') return false;
    if (status === 'brn' && (a === 'waterveil' || a === 'waterbubble' || a === 'thermalexchange')) return false;
    if ((status === 'psn' || status === 'tox') && (a === 'immunity' || a === 'pastelveil')) return false;
    if (status === 'slp' && (a === 'insomnia' || a === 'vitalspirit' || a === 'sweetveil')) return false;
    if (status === 'frz' && a === 'magmaarmor') return false;
    if (a === 'flowerveil' && foe.hasType('Grass')) return false;
  }
  if (foe.side.sideConditions['safeguard'] && myAbility !== 'infiltrator') return false;
  if (battle.field.terrain === 'mistyterrain' && foe.isGrounded()) return false;
  if (status === 'slp' && battle.field.terrain === 'electricterrain' && foe.isGrounded()) return false;
  if (status === 'slp' && sleepClauseBlocks(foe.side)) return false;
  if (status === 'slp' && foe.volatiles['yawn'] && move.id === 'yawn') return false;
  if (status === 'frz' && isSun(env)) return false;
  return true;
}

/** How valuable it is to inflict `status` on the foe (score units, before accuracy). */
export function statusValue(env: Env, me: Pokemon, foe: Pokemon, status: string, myThreat: Threat): number {
  const foeFaster = speedOrderProb(me, foe) < 1;
  switch (status) {
    case 'par': {
      let v = 35;
      if (foeFaster) v += 20;
      if (hasMove(foe, SETUP_IDS)) v += 5;
      if (foe.hasAbility('guts') || foe.hasAbility('quickfeet')) v -= 25;
      return v;
    }
    case 'brn': {
      const foeThreat = analyzeThreat(env, foe, me, { includeStab: false });
      let v = 25;
      if (foeThreat.physicalShare >= 0.5 || effectiveStat(foe, 'atk') > effectiveStat(foe, 'spa')) v += 30;
      if (foe.hasAbility('guts') || foe.hasAbility('flareboost') || foe.hasAbility('marvelscale')) v -= 30;
      return v;
    }
    case 'tox': {
      const bulky = hasMove(foe, RECOVERY_IDS) || myThreat.expectedPct < 35;
      let v = 35;
      if (bulky) v += 20;
      if (hpPct(foe) < 40) v -= 20;
      if (foe.hasAbility('poisonheal') || foe.hasAbility('guts') || foe.hasAbility('toxicboost') || foe.hasAbility('magicguard')) v -= 40;
      return v;
    }
    case 'psn': {
      let v = 30;
      if (hpPct(foe) < 40) v -= 15;
      if (foe.hasAbility('poisonheal') || foe.hasAbility('guts') || foe.hasAbility('toxicboost') || foe.hasAbility('magicguard')) v -= 40;
      return v;
    }
    case 'slp': {
      let v = 60;
      if (hasMove(foe, ['sleeptalk'])) v -= 25;
      if (foe.hasItem('chestoberry') || foe.hasItem('lumberry')) v -= 25;
      return v;
    }
    case 'frz':
      return 60;
    default:
      return 10;
  }
}

/** Build a forme override for a Mega Evolution preview. */
export function megaForme(env: Env, speciesName: string): FormeOverride | null {
  const species = env.battle.dex.species.get(speciesName);
  if (!species.exists) return null;
  return { species: species.name, ability: species.abilities['0'] };
}

function teamBenefitsFromWeather(side: Side, weather: string): number {
  let n = 0;
  for (const p of side.pokemon) {
    if (!alive(p)) continue;
    const abilities = p.ability;
    switch (weather) {
      case 'raindance':
        if (p.hasType('Water') || ['swiftswim', 'raindish', 'dryskin', 'hydration'].includes(abilities) || hasMove(p, ['thunder', 'hurricane', 'weatherball'])) n++;
        break;
      case 'sunnyday':
        if (p.hasType('Fire') || ['chlorophyll', 'solarpower', 'harvest', 'flowergift', 'leafguard', 'protosynthesis'].includes(abilities) || hasMove(p, ['solarbeam', 'solarblade', 'growth', 'morningsun', 'synthesis', 'moonlight'])) n++;
        break;
      case 'sandstorm':
        if (p.hasType('Rock') || ['sandrush', 'sandforce', 'sandveil'].includes(abilities) || hasMove(p, ['shoreup'])) n++;
        break;
      case 'snowscape':
      case 'hail':
        if (p.hasType('Ice') || ['slushrush', 'snowcloak', 'icebody', 'iceface'].includes(abilities) || hasMove(p, ['auroraveil', 'blizzard'])) n++;
        break;
      default:
        break;
    }
  }
  return n;
}

function teamBenefitsFromTerrain(side: Side, terrain: string): number {
  let n = 0;
  for (const p of side.pokemon) {
    if (!alive(p)) continue;
    switch (terrain) {
      case 'electricterrain':
        if (p.hasType('Electric') || ['surgesurfer', 'quarkdrive', 'hadronengine'].includes(p.ability)) n++;
        break;
      case 'grassyterrain':
        if (p.hasType('Grass') || p.ability === 'grasspelt' || hasMove(p, ['grassyglide'])) n++;
        break;
      case 'psychicterrain':
        if (p.hasType('Psychic') || hasMove(p, ['expandingforce'])) n++;
        break;
      case 'mistyterrain':
        if (p.hasType('Fairy') || hasMove(p, ['mistyexplosion'])) n++;
        break;
      default:
        break;
    }
  }
  return n;
}

/** Score a damaging move. */
function scoreDamagingMove(env: Env, move: Move, mc: MoveContext): MoveEval {
  const { battle, side, dmg } = env;
  const { me, foe, threat, myThreat, forme, useZ } = mc;
  const opts = { attackerForme: forme, useZ };
  if (isImmune(battle, move, me, foe, opts)) return blank(-100, 'target is immune', { immune: true });
  const est = dmg.estimate(me, foe, move.id, opts);
  if (est.immune) return blank(-100, 'target is immune', { immune: true });
  const acc = hitChance(battle, move, me, foe, opts);
  const myPrio = effectivePriority(env, me, move, forme);
  const pFirst = movesFirstProb(me, foe, myPrio, threat.priority);
  const pFirstNoPrio = speedOrderProb(me, foe);

  // Counter-style moves: the model returns 0, value them from the foe's expected attack.
  if (est.max <= 0 && est.source === 'none') {
    if (['counter', 'mirrorcoat', 'metalburst', 'comeuppance'].includes(move.id)) {
      const matches =
        move.id === 'counter' ? threat.category === 'Physical' : move.id === 'mirrorcoat' ? threat.category === 'Special' : threat.category !== null;
      if (!matches || !threat.hasDamaging || threat.koChance >= 0.5) return blank(0, 'counter would not work');
      const mult = move.id === 'counter' || move.id === 'mirrorcoat' ? 2 : 1.5;
      const dmgHp = (threat.expectedPctOfMax / 100) * me.maxhp * mult;
      const pct = (dmgHp / Math.max(1, foe.hp)) * 100;
      return blank(Math.min(100, pct) * 0.5 + (pct >= 100 ? 15 : 0), `counter ~${pct.toFixed(0)}%`, { priority: myPrio });
    }
    return blank(5, 'no damage');
  }
  if (est.max <= 0) return blank(0, 'no damage');

  let expected = Math.min(100, (est.minPct + est.maxPct) / 2) * acc;
  let ko = est.koChance * acc;
  const avgHp = (est.min + est.max) / 2;

  // Substitute soaks the hit: no KO this turn.
  const myAbility = effectiveAbility(battle, me, forme);
  if (foe.volatiles['substitute'] && !(move.flags.sound || move.flags.bypasssub || myAbility === 'infiltrator')) {
    const subHp = Number(foe.volatiles['substitute'].hp ?? Math.floor(foe.maxhp / 4));
    expected = Math.min(expected, (subHp / Math.max(1, foe.hp)) * 100 + 5);
    ko = 0;
  }

  let score = expected + ko * KO_BONUS;
  const notes: string[] = [`${est.minPct.toFixed(0)}–${est.maxPct.toFixed(0)}%`];
  if (acc < 1) notes.push(`acc ${(acc * 100).toFixed(0)}%`);
  if (ko > 0) notes.push(`KO ${(ko * 100).toFixed(0)}%`);

  // Priority.
  if (move.priority > 0) {
    if (ko >= 0.5) score += 30;
    else if (ko > 0) score += 15 * ko;
    if (pFirstNoPrio < 1 && threat.koChance >= 0.4 && ko > 0) score += 20;
  }
  // Likely to be KOed before moving.
  if (threat.koChance > 0 && pFirst < 1) {
    const factor = 1 - (1 - pFirst) * threat.koChance * 0.7;
    score *= factor;
    notes.push(`outsped-risk ×${factor.toFixed(2)}`);
  }

  // Recoil and self damage.
  const magicGuard = myAbility === 'magicguard';
  if (move.recoil && myAbility !== 'rockhead' && !magicGuard) {
    const r = (avgHp * move.recoil[0]) / move.recoil[1];
    score -= (r / me.maxhp) * 100 * 0.35;
    if (r >= me.hp && ko < 0.9) score -= 30;
  }
  if (move.mindBlownRecoil && !magicGuard) {
    score -= 20;
    if (me.hp <= me.maxhp / 2 && ko < 0.9) score -= 40;
  }
  if (move.hasCrashDamage) score -= (1 - acc) * 30;
  if (move.struggleRecoil) score -= 15;
  if (move.selfdestruct) {
    const aboutToDie = (threat.koChance >= 0.5 && pFirst < 1) || hpPct(me) < 25;
    if (ko >= 0.5 && (side.pokemonLeft <= 2 || aboutToDie)) {
      score += 10;
      notes.push('self-KO acceptable');
    } else {
      return blank(-80, 'self-KO not worth it', { priority: myPrio, koChance: ko });
    }
  }

  // Charge / recharge.
  if (move.flags.charge) {
    const instant =
      me.hasItem('powerherb') ||
      ((move.id === 'solarbeam' || move.id === 'solarblade') && isSun(env)) ||
      (move.id === 'electroshot' && isRain(env));
    if (!instant) {
      score *= 0.45;
      if (threat.koChance > 0.3) score *= 0.4;
      notes.push('charge turn');
    }
  }
  if (move.flags.recharge) score *= ko >= 0.5 ? 0.9 : 0.6;

  // Situational moves.
  if (move.id === 'suckerpunch' || move.id === 'thunderclap') {
    score *= threat.hasDamaging ? 0.75 : 0.2;
    if (foe.lastMove && foe.lastMove.category === 'Status') score *= 0.6;
  }
  if ((move.id === 'fakeout' || move.id === 'firstimpression') && me.activeMoveActions >= 1) return blank(-100, 'only works on the first turn');
  if (move.id === 'focuspunch') score *= 0.35;
  if (move.id === 'dreameater' && foe.status !== 'slp') return blank(-100, 'target is not asleep');
  if (move.id === 'snore' && me.status !== 'slp') return blank(-100, 'user is not asleep');
  if (move.id === 'belch' && !me.ateBerry) return blank(-100, 'no berry eaten');
  if (move.id === 'poltergeist' && !foe.item) return blank(-100, 'target has no item');
  if (move.id === 'steelroller' && !battle.field.terrain) return blank(-100, 'no terrain');
  if (move.id === 'burnup' && !me.hasType('Fire')) return blank(-100, 'not Fire type');
  if (move.id === 'doubleshock' && !me.hasType('Electric')) return blank(-100, 'not Electric type');
  if (move.id === 'fling' && !me.item) return blank(-100, 'no item to fling');
  if (move.id === 'spitup' && !me.volatiles['stockpile']) return blank(-100, 'nothing stockpiled');
  if (move.id === 'synchronoise' && !me.getTypes().some((t) => foe.hasType(t))) return blank(-100, 'no shared type');
  if (move.id === 'hyperspacefury' && me.species.id !== 'hoopaunbound') return blank(-100, 'wrong user');
  if (move.id === 'aurawheel' && !me.species.id.startsWith('morpeko')) return blank(-100, 'wrong user');
  if (move.id === 'lastresort') score *= 0.3;
  if (move.id === 'futuresight' || move.id === 'doomdesire') score *= 0.6;
  if (move.id === 'rollout' || move.id === 'iceball') score *= 0.6;
  if (move.id === 'thrash' || move.id === 'outrage' || move.id === 'petaldance' || move.id === 'ragingfury') score *= 0.9;
  if (move.id === 'uproar') score *= 0.9;
  if (move.id === 'bide') return blank(-50, 'bide');
  if (move.flags.defrost && me.status === 'frz') score += 30;

  // Secondary effects.
  const secondaries = move.secondaries ?? (move.secondary ? [move.secondary] : []);
  if (myAbility !== 'sheerforce') {
    for (const sec of secondaries) {
      const shield = foe.hasAbility('shielddust') || foe.hasItem('covertcloak');
      if (shield) break;
      const chance = Math.min(1, ((sec.chance ?? 100) / 100) * (myAbility === 'serenegrace' ? 2 : 1));
      if (sec.status && canBeStatused(env, me, foe, sec.status, move, forme)) {
        score += chance * statusValue(env, me, foe, sec.status, myThreat) * 0.5;
      }
      if (sec.boosts && !STAT_DROP_IMMUNE.has(foe.ability)) {
        let drop = 0;
        for (const v of Object.values(sec.boosts)) if (typeof v === 'number' && v < 0) drop += -v;
        score += chance * 6 * drop;
      }
      if (sec.volatileStatus === 'flinch' && pFirst > 0 && !foe.hasAbility('innerfocus')) score += chance * pFirst * 12;
      if (sec.volatileStatus === 'confusion' && !foe.hasAbility('owntempo')) score += chance * 5;
      if (sec.self?.boosts) {
        let gain = 0;
        for (const v of Object.values(sec.self.boosts)) if (typeof v === 'number') gain += v;
        score += chance * 5 * gain;
      }
    }
  }
  if (move.self?.boosts) {
    let sum = 0;
    for (const v of Object.values(move.self.boosts)) if (typeof v === 'number') sum += v;
    if (sum < 0) score -= ko >= 0.5 ? 2 : 4 * -sum;
    else score += 4 * sum;
  }
  if (move.self?.volatileStatus === 'lockedmove') score *= 0.95;

  // Utility riders.
  const pivot = !!move.selfSwitch;
  if (pivot) {
    score += 4;
    if (threat.koChance >= 0.4 || threat.expectedPct >= 50) score += 10;
    if (side.pokemonLeft <= 1) score -= 10;
  }
  if (move.id === 'knockoff' && foe.item && !foe.hasAbility('stickyhold')) score += 8;
  if ((move.id === 'rapidspin' || move.id === 'mortalspin') && hazardLayers(side) > 0 && side.pokemonLeft >= 2) score += 25;
  if (move.forceSwitch) {
    const foeBoosts = positiveBoostSum(foe);
    if (foe.side.pokemonLeft > 1 && !foe.hasAbility('suctioncups') && !foe.volatiles['ingrain']) {
      if (foeBoosts >= 2) score += 20;
      score += hazardLayers(foe.side) * 6;
    }
  }
  if (move.drain && !foe.hasAbility('liquidooze')) {
    const heal = ((avgHp * move.drain[0]) / move.drain[1] / me.maxhp) * 100;
    score += heal * (hpPct(me) < 60 ? 0.4 : 0.1);
  }
  if (move.id === 'clearsmog' && positiveBoostSum(foe) >= 2) score += 30;
  if (move.id === 'spectralthief' && positiveBoostSum(foe) >= 1) score += 10 * positiveBoostSum(foe);
  if (move.flags.contact) {
    if (foe.hasAbility('roughskin') || foe.hasAbility('ironbarbs') || foe.hasItem('rockyhelmet')) score -= 4;
    if (foe.hasAbility('flamebody') || foe.hasAbility('static') || foe.hasAbility('effectspore')) score -= 3;
  }
  if (useZ) notes.push('Z-move');

  return { score, detail: notes.join(', '), priority: myPrio, koChance: ko, immune: false, longTerm: false, recovery: false, protect: false, pivot };
}

/** Score a status move in context. */
function scoreStatusMove(env: Env, move: Move, mc: MoveContext): MoveEval {
  const { battle, side } = env;
  const { me, foe, threat, myThreat, forme } = mc;
  const id = move.id;
  const myAbility = effectiveAbility(battle, me, forme);
  const myPrio = effectivePriority(env, me, move, forme);
  const pFirst = movesFirstProb(me, foe, myPrio, threat.priority);
  const pFirstNoPrio = speedOrderProb(me, foe);
  const myHp = hpPct(me);
  const acc = targetsFoe(move) ? hitChance(battle, move, me, foe, { attackerForme: forme }) : 1;
  const canKO = myThreat.koChance >= 0.5 && pFirstNoPrio >= 0.5;
  const foeBoosts = positiveBoostSum(foe);
  const myBoosts = positiveBoostSum(me);

  const finish = (score: number, detail: string, extra: Partial<MoveEval> = {}): MoveEval => {
    let s = score;
    // Being KOed before the move resolves wastes it.
    if (s > 0 && threat.koChance > 0 && pFirst < 1) s *= 1 - (1 - pFirst) * threat.koChance * 0.7;
    return { ...blank(s, detail, extra), priority: myPrio };
  };

  if (USELESS_STATUS.has(id)) return finish(-100, 'useless in singles');

  // Generic failure cases for moves aimed at the foe.
  if (targetsFoe(move)) {
    const bypassesSub = !!move.flags.bypasssub || !!move.flags.sound || myAbility === 'infiltrator';
    if (foe.volatiles['substitute'] && !bypassesSub) return finish(-50, 'blocked by Substitute');
    if (myAbility === 'prankster' && foe.hasType('Dark')) return finish(-50, 'Prankster fails vs Dark');
    if (foe.hasAbility('magicbounce') && move.flags.reflectable && myAbility !== 'moldbreaker') return finish(-40, 'Magic Bounce');
    if (foe.hasAbility('goodasgold')) return finish(-50, 'Good as Gold');
    if (move.flags.sound && foe.hasAbility('soundproof')) return finish(-50, 'Soundproof');
  }

  // Protect family.
  if (PROTECT_IDS.includes(id) || id === 'endure') {
    if (me.volatiles['stall'] || (me.lastMove && PROTECT_IDS.includes(me.lastMove.id) && me.moveThisTurn === false && me.activeTurns > 0 && me.volatiles['stall'])) {
      return finish(-60, 'used Protect last turn');
    }
    if (me.lastMove && PROTECT_IDS.includes(me.lastMove.id) && me.activeTurns > 0) return finish(-60, 'used Protect last turn');
    if (!threat.hasDamaging) return finish(-10, 'nothing to protect from');
    let s = id === 'endure' ? 5 : 15;
    const residual = residualDamage(env, foe);
    s += residual;
    if (foe.volatiles['twoturnmove']) s += 45;
    if (foe.volatiles['mustrecharge']) s -= 40;
    if (myHp < 100 && (me.hasItem('leftovers') || (me.hasItem('blacksludge') && me.hasType('Poison')) || myAbility === 'poisonheal' || me.volatiles['aquaring'] || me.volatiles['ingrain'])) s += 8;
    const wishPending = !!side.slotConditions[me.position]?.['wish'] || me.lastMove?.id === 'wish';
    if (wishPending) s += 35;
    if (foe.activeTurns === 0 && env.difficulty !== 'normal') s += 8;
    if (foe.status === 'slp' || foe.status === 'frz') s -= 20;
    if (id === 'kingsshield' || id === 'spikyshield' || id === 'banefulbunker' || id === 'burningbulwark' || id === 'obstruct' || id === 'silktrap') s += 3;
    return finish(s, `protect (residual ${residual})`, { protect: true });
  }

  // Recovery.
  if (RECOVERY_IDS.includes(id)) {
    const missing = 100 - myHp;
    const incoming = threat.expectedPctOfMax;
    if (id === 'rest') {
      if (me.status === 'slp' || myAbility === 'insomnia' || myAbility === 'vitalspirit' || myHp >= 100) return finish(-40, 'Rest would fail');
      const needs = myHp < 40 || me.status === 'tox' || me.status === 'brn' || me.status === 'psn';
      const safeSleep = hasMove(me, ['sleeptalk']) || me.hasItem('chestoberry') || incoming < 12;
      if (needs && safeSleep && !(threat.koChance >= 0.5 && pFirst < 1)) return finish(40 + (60 - myHp) * 0.8, 'rest', { recovery: true });
      return finish(-30, 'rest not worth it');
    }
    if (id === 'strengthsap') {
      if (foe.hasAbility('liquidooze') || (foe.boosts.atk ?? 0) <= -6) return finish(-40, 'Strength Sap fails');
      const healPct = Math.min(missing, (effectiveStat(foe, 'atk') / me.maxhp) * 100);
      let s = myHp < 50 ? 45 + (50 - myHp) + healPct * 0.3 : 15;
      if (threat.category === 'Physical' && !STAT_DROP_IMMUNE.has(foe.ability)) s += 15;
      if ((1 - pFirst) * threat.koChance >= 0.5) s = 5;
      return finish(s, 'strength sap', { recovery: true });
    }
    if (id === 'painsplit') {
      if (foe.hp <= me.hp) return finish(-20, 'Pain Split would hurt');
      const avg = (foe.hp + me.hp) / 2;
      const healPct = ((avg - me.hp) / me.maxhp) * 100;
      const dmgPct = ((foe.hp - avg) / foe.hp) * 100;
      if (myHp >= 50) return finish(10 + dmgPct * 0.3, 'pain split');
      return finish(30 + healPct * 0.8 + dmgPct * 0.4, 'pain split', { recovery: true });
    }
    let frac = 0.5;
    if (id === 'synthesis' || id === 'moonlight' || id === 'morningsun') frac = isSun(env) ? 2 / 3 : battle.field.effectiveWeather() ? 0.25 : 0.5;
    if (id === 'shoreup') frac = isSand(env) ? 2 / 3 : 0.5;
    if (id === 'lifedew' || id === 'junglehealing' || id === 'lunarblessing') frac = 0.25;
    if (id === 'swallow') {
      const layers = Number(me.volatiles['stockpile']?.layers ?? 0);
      if (!layers) return finish(-50, 'nothing stockpiled');
      frac = layers >= 3 ? 1 : layers === 2 ? 0.5 : 0.25;
    }
    if (id === 'wish') {
      if (side.slotConditions[me.position]?.['wish']) return finish(-30, 'Wish already pending');
    }
    const healPct = Math.min(frac * 100, missing);
    let s: number;
    if (myHp >= 50) s = missing >= 30 && incoming < 12 ? 20 : 5;
    else if ((1 - pFirst) * threat.koChance >= 0.5) s = 5;
    else if (incoming >= healPct) s = 12;
    else s = 50 + (50 - myHp) * 1.2 + (healPct - incoming) * 0.2;
    if (id === 'wish') s *= 0.7;
    if (id === 'junglehealing' || id === 'lunarblessing') s += me.status ? 10 : 0;
    if (id === 'roost' && me.hasType('Flying') && threat.category && typeEffectiveness(battle, 'Ground', me) < -1) s -= 5;
    return finish(s, `recover (${healPct.toFixed(0)}% vs incoming ${incoming.toFixed(0)}%)`, { recovery: true });
  }

  // Hazards.
  if (move.sideCondition && targetsFoe(move)) {
    const sc = foe.side.sideConditions;
    const maxLayers: Record<string, number> = { stealthrock: 1, spikes: 3, toxicspikes: 2, stickyweb: 1 };
    const condId = move.sideCondition;
    if (condId in maxLayers) {
      const existing = sc[condId] ? Number(sc[condId].layers ?? 1) : 0;
      if (existing >= maxLayers[condId]) return finish(-30, 'hazard already up');
      const foeLeft = foe.side.pokemonLeft;
      let s: number;
      if (foeLeft < 3) s = 5 + (foeLeft - 1) * 3;
      else s = 45 + (foeLeft - 3) * 4 + (battle.turn <= 3 ? 8 : 0) + (condId === 'stealthrock' ? 5 : 0) - existing * 15;
      if (condId === 'toxicspikes') {
        const foes = foe.side.pokemon.filter((p) => alive(p));
        if (foes.some((p) => p.hasType('Poison') && p.isGrounded())) s *= 0.5;
        if (!foes.some((p) => p.isGrounded() && !p.hasType('Steel') && !p.hasType('Poison'))) s = -10;
      }
      if (condId === 'stickyweb' && !foe.side.pokemon.some((p) => alive(p) && p.isGrounded())) s = -10;
      if (hasMove(foe, HAZARD_REMOVAL_IDS)) s *= 0.7;
      return finish(s, `hazard (${foeLeft} foes left)`, { longTerm: true });
    }
  }

  // Direct status infliction.
  if (move.status || id === 'yawn') {
    const status = move.status ?? 'slp';
    if (!canBeStatused(env, me, foe, status, move, forme)) return finish(-50, `cannot inflict ${status}`);
    let v = statusValue(env, me, foe, status, myThreat) * acc;
    if (id === 'yawn') v *= 0.8;
    if (canKO) v *= 0.5;
    if (foe.status === '' && foe.hasAbility('synchronize') && !me.status) v -= 10;
    return finish(v, `inflict ${status}`);
  }

  // Setup.
  const isSetup = (move.target === 'self' && move.boosts && Object.values(move.boosts).some((v) => typeof v === 'number' && v > 0)) || SETUP_IDS.includes(id);
  if (isSetup && id !== 'curse' && id !== 'bellydrum' && id !== 'stockpile' && id !== 'tidyup' && id !== 'charge' && id !== 'focusenergy' && id !== 'minimize' && id !== 'doubleteam') {
    const boosts: Partial<Record<string, number>> = { ...(move.boosts ?? {}) };
    if (id === 'growth' && isSun(env)) {
      boosts.atk = 2;
      boosts.spa = 2;
    }
    return finish(...setupValue(env, mc, move, boosts, pFirstNoPrio, canKO));
  }
  if (id === 'curse') {
    if (me.hasType('Ghost')) {
      if (foe.volatiles['curse'] || myHp <= 50) return finish(-30, 'ghost curse not worth it');
      return finish(side.pokemonLeft >= 2 || myHp > 75 ? 30 : 5, 'ghost curse');
    }
    return finish(...setupValue(env, mc, move, { atk: 1, def: 1 }, pFirstNoPrio, canKO));
  }
  if (id === 'bellydrum') {
    const physical = me.moveSlots.some((s) => battle.dex.moves.get(s.id).category === 'Physical');
    const safe = myHp > 60 && threat.maxPct < 45 && !(threat.koChance >= 0.5 && pFirst < 1);
    if ((me.boosts.atk ?? 0) >= 4 || myHp <= 50 || !physical) return finish(-40, 'belly drum would fail/waste');
    return finish(safe ? 72 : -20, 'belly drum', { longTerm: true });
  }
  if (id === 'stockpile') {
    if (Number(me.volatiles['stockpile']?.layers ?? 0) >= 3) return finish(-30, 'stockpile maxed');
    return finish(...setupValue(env, mc, move, { def: 1, spd: 1 }, pFirstNoPrio, canKO));
  }
  if (id === 'tidyup') {
    const own = hazardLayers(side);
    const theirs = hazardLayers(foe.side);
    const [s, d] = setupValue(env, mc, move, { atk: 1, spe: 1 }, pFirstNoPrio, canKO);
    return finish(s + own * 8 - theirs * 5 + (foe.volatiles['substitute'] ? 10 : 0), `tidy up (${d})`, { longTerm: true });
  }
  if (id === 'charge') return finish(me.moveSlots.some((s) => battle.dex.moves.get(s.id).type === 'Electric') ? 10 : -20, 'charge');
  if (id === 'focusenergy') return finish(me.volatiles['focusenergy'] ? -30 : 10, 'focus energy');
  if (id === 'minimize' || id === 'doubleteam') return finish(me.boosts.evasion >= 2 ? -20 : 12, 'evasion');

  // Screens.
  if (id === 'reflect' || id === 'lightscreen' || id === 'auroraveil') {
    if (side.sideConditions[id]) return finish(-30, 'screen already up');
    if (id === 'auroraveil' && !isSnow(env)) return finish(-50, 'Aurora Veil needs snow');
    let s = 30 + (side.pokemonLeft >= 2 ? 5 : -10);
    if ((id === 'reflect' && threat.category === 'Physical') || (id === 'lightscreen' && threat.category === 'Special') || id === 'auroraveil') s += 15;
    if (myHp < 30) s *= 0.5;
    if (me.hasItem('lightclay')) s += 5;
    if (foe.hasAbility('infiltrator') || hasMove(foe, ['brickbreak', 'psychicfangs', 'ragingbull', 'defog'])) s *= 0.6;
    return finish(s, 'screen', { longTerm: true });
  }

  if (id === 'substitute' || id === 'shedtail') {
    if (me.volatiles['substitute']) return finish(-40, 'already behind a Substitute');
    if (myHp <= 25) return finish(-50, 'too little HP for Substitute');
    if (id === 'shedtail') return finish(side.pokemonLeft >= 2 && myHp > 50 ? 30 + (threat.koChance >= 0.4 ? 15 : 0) : -30, 'shed tail', { pivot: true });
    let s = 25;
    if (threat.expectedPctOfMax < 25) s += 15;
    if (statusMoveCount(battle, foe) >= 2) s += 10;
    if (foe.status === 'slp' || foe.status === 'frz') s += 15;
    if (me.hasItem('leftovers')) s += 5;
    if (foe.hasAbility('infiltrator') || foe.moveSlots.some((sl) => battle.dex.moves.get(sl.id).flags.sound)) s *= 0.5;
    return finish(s, 'substitute');
  }

  if (id === 'taunt') {
    if (foe.volatiles['taunt'] || foe.hasAbility('oblivious')) return finish(-40, 'Taunt would fail');
    const n = statusMoveCount(battle, foe);
    if (n >= 2) return finish(35 + (hasMove(foe, SETUP_IDS) || hasMove(foe, RECOVERY_IDS) ? 15 : 0), 'taunt');
    if (n === 1) return finish(hasMove(foe, SETUP_IDS) || hasMove(foe, RECOVERY_IDS) ? 25 : 12, 'taunt');
    return finish(-10, 'taunt pointless');
  }

  if (id === 'encore') {
    if (foe.volatiles['encore'] || foe.hasAbility('aromaveil')) return finish(-40, 'Encore would fail');
    if (!foe.lastMove || foe.activeTurns === 0) return finish(-30, 'nothing to Encore');
    const last = foe.lastMove;
    if (last.category === 'Status') return finish(50, `encore ${last.name}`);
    if (typeEffectiveness(battle, resolveMoveType(battle, last, foe), me) < 0 || isImmune(battle, last, foe, me)) return finish(45, `encore resisted ${last.name}`);
    return finish(-10, 'encore pointless');
  }

  if (id === 'haze') {
    if (foeBoosts >= 2) return finish(35 + 12 * foeBoosts - 8 * myBoosts, 'haze');
    return finish(-15, 'nothing to haze');
  }
  if (id === 'topsyturvy') return finish(foeBoosts >= 2 ? 50 + 8 * foeBoosts : -15, 'topsy-turvy');
  if (id === 'psychup') return finish(foeBoosts >= 2 ? 35 + 5 * foeBoosts : -15, 'psych up');
  if (id === 'heartswap') return finish(foeBoosts - myBoosts >= 2 ? 45 : -15, 'heart swap');

  if (id === 'roar' || id === 'whirlwind') {
    if (foe.hasAbility('suctioncups') || foe.volatiles['ingrain'] || foe.side.pokemonLeft <= 1) return finish(-40, 'phazing would fail');
    if (foe.volatiles['dynamax']) return finish(-40, 'cannot phaze');
    if (foeBoosts >= 2) return finish(45 + 10 * foeBoosts, 'phaze boosted foe');
    const layers = hazardLayers(foe.side);
    if (layers > 0) return finish(15 + 8 * layers, 'phaze into hazards');
    return finish(3, 'phaze');
  }

  if (id === 'defog' || id === 'courtchange') {
    const own = hazardLayers(side);
    const theirs = hazardLayers(foe.side);
    const foeScreens = ['reflect', 'lightscreen', 'auroraveil'].filter((c) => foe.side.sideConditions[c]).length;
    if (id === 'courtchange') return finish(own > theirs ? 25 + (own - theirs) * 8 : -10, 'court change');
    if (own > 0 && side.pokemonLeft >= 2) return finish(35 + 8 * own - 6 * theirs + foeScreens * 10, 'defog hazards');
    return finish(foeScreens ? 20 : -10, 'defog');
  }

  if (move.weather) {
    const target = battle.dex.conditions.get(move.weather).id;
    const current = battle.field.weather;
    if (current === target) return finish(-30, 'weather already active');
    if (current === 'desolateland' || current === 'primordialsea' || current === 'deltastream') return finish(-40, 'cannot override strong weather');
    const benefit = teamBenefitsFromWeather(side, target);
    const foeBenefit = teamBenefitsFromWeather(foe.side, target);
    const s = benefit > 0 ? 22 + 10 * benefit - 6 * foeBenefit : -5;
    return finish(s, `weather (${benefit} benefit)`, { longTerm: true });
  }
  if (id === 'chillyreception') {
    const benefit = teamBenefitsFromWeather(side, 'snowscape');
    return finish((battle.field.weather === 'snowscape' ? 5 : 15 + 8 * benefit) + (threat.koChance >= 0.4 ? 10 : 0), 'chilly reception', { pivot: true });
  }
  if (move.terrain) {
    const target = battle.dex.conditions.get(move.terrain).id;
    if (battle.field.terrain === target) return finish(-30, 'terrain already active');
    const benefit = teamBenefitsFromTerrain(side, target);
    const foeBenefit = teamBenefitsFromTerrain(foe.side, target);
    return finish(benefit > 0 ? 18 + 8 * benefit - 5 * foeBenefit : -5, `terrain (${benefit} benefit)`, { longTerm: true });
  }
  if (id === 'trickroom') {
    if (battle.field.getPseudoWeather('trickroom')) return finish(-40, 'Trick Room already active');
    const team = side.pokemon.filter((p) => alive(p));
    const foeSpe = foe.getStat('spe');
    const slow = team.filter((p) => p.getStat('spe') < foeSpe).length;
    if (slow >= Math.ceil(team.length / 2)) return finish(30 + 8 * slow, 'trick room (slow team)', { longTerm: true });
    return finish(-15, 'trick room (fast team)');
  }
  if (id === 'tailwind') {
    if (side.sideConditions['tailwind']) return finish(-30, 'Tailwind already active');
    return finish(pFirstNoPrio < 1 ? 35 : -10, 'tailwind', { longTerm: true });
  }
  if (id === 'gravity') return finish(battle.field.getPseudoWeather('gravity') ? -30 : 5, 'gravity');

  if (id === 'leechseed') {
    if (foe.hasType('Grass') || foe.volatiles['leechseed'] || foe.hasAbility('liquidooze')) return finish(-50, 'Leech Seed fails');
    let s = 35 + (myHp < 70 ? 10 : 0) + (hasMove(me, PROTECT_IDS) || hasMove(me, ['substitute']) ? 5 : 0);
    s *= acc;
    return finish(s, 'leech seed');
  }

  if (id === 'trick' || id === 'switcheroo') {
    if (foe.hasAbility('stickyhold') || !me.item || foe.volatiles['substitute']) return finish(-40, 'Trick would fail');
    if (BAD_ITEMS.has(me.item) && !BAD_ITEMS.has(foe.item)) {
      return finish(30 + (statusMoveCount(battle, foe) >= 2 ? 15 : 0) + (CHOICE_ITEMS.has(me.item) && hasMove(foe, SETUP_IDS) ? 10 : 0), 'trick choice item');
    }
    return finish(-10, 'trick pointless');
  }

  if (id === 'destinybond') {
    if (me.volatiles['destinybond'] || (me.lastMove && me.lastMove.id === 'destinybond')) return finish(-40, 'Destiny Bond would fail');
    if (threat.koChance >= 0.5 && pFirst >= 0.5 && myThreat.koChance < 0.5) return finish(45, 'destiny bond');
    return finish(-10, 'destiny bond pointless');
  }

  if (id === 'healbell' || id === 'aromatherapy') {
    const n = side.pokemon.filter((p) => alive(p) && p.status).length;
    return finish(n >= 1 ? 20 + 12 * n : -15, 'cure team');
  }
  if (id === 'refresh') return finish(['brn', 'par', 'psn', 'tox'].includes(me.status) ? 30 : -40, 'refresh');
  if (id === 'sleeptalk') return finish(me.status === 'slp' ? 60 : -100, 'sleep talk');
  if (id === 'batonpass') {
    if (side.pokemonLeft <= 1) return finish(-40, 'nothing to pass to');
    if (myBoosts >= 2) return finish(threat.koChance >= 0.3 ? 35 + 5 * myBoosts : 15, 'baton pass boosts', { pivot: true });
    return finish(threat.koChance >= 0.5 ? 15 : -10, 'baton pass', { pivot: true });
  }
  if (id === 'teleport' || id === 'partingshot') {
    if (side.pokemonLeft <= 1) return finish(-30, 'no switch target');
    return finish((id === 'partingshot' ? 20 : 10) + (threat.koChance >= 0.4 || threat.expectedPct >= 50 ? 15 : 0), id, { pivot: true });
  }
  if (id === 'memento') {
    if (side.pokemonLeft >= 2 && ((threat.koChance >= 0.5 && pFirst < 1) || myHp < 20)) return finish(25, 'memento');
    return finish(-60, 'memento');
  }
  if (id === 'attract') {
    if (!foe.gender || !me.gender || foe.gender === me.gender || foe.hasAbility('oblivious') || foe.volatiles['attract']) return finish(-40, 'Attract fails');
    return finish(20, 'attract');
  }
  if (move.volatileStatus === 'confusion') {
    if (foe.volatiles['confusion'] || foe.hasAbility('owntempo')) return finish(-40, 'already confused');
    return finish((id === 'swagger' || id === 'flatter' ? 8 : 15) * acc, 'confuse');
  }
  if (id === 'disable') return finish(!foe.lastMove || foe.volatiles['disable'] || foe.activeTurns === 0 ? -30 : 20, 'disable');
  if (id === 'torment') return finish(foe.volatiles['torment'] ? -30 : 10, 'torment');
  if (id === 'spite') return finish(5, 'spite');
  if (id === 'magnetrise') {
    if (me.volatiles['magnetrise'] || !me.isGrounded()) return finish(-40, 'Magnet Rise pointless');
    const hasGround = foe.moveSlots.some((s) => battle.dex.moves.get(s.id).type === 'Ground');
    return finish(hasGround && typeEffectiveness(battle, 'Ground', me) > 0 ? 35 : -10, 'magnet rise');
  }
  if (id === 'perishsong') {
    if (foe.hasAbility('soundproof')) return finish(-40, 'Soundproof');
    return finish(foeBoosts >= 2 && side.pokemonLeft >= 2 ? 35 : 10, 'perish song');
  }
  if (id === 'safeguard') return finish(side.sideConditions['safeguard'] ? -30 : statusMoveCount(battle, foe) >= 1 ? 15 : -5, 'safeguard');
  if (id === 'nightmare') return finish(foe.status === 'slp' && !foe.volatiles['nightmare'] ? 25 : -50, 'nightmare');
  if (id === 'healblock') return finish(hasMove(foe, RECOVERY_IDS) && !foe.volatiles['healblock'] ? 25 : -20, 'heal block');
  if (id === 'gastroacid') return finish(foe.volatiles['gastroacid'] ? -30 : 15, 'gastro acid');
  if (id === 'aquaring' || id === 'ingrain') return finish(me.volatiles[id] ? -30 : myHp < 80 ? 15 : 8, id);
  if (id === 'metronome' || id === 'assist' || id === 'copycat' || id === 'mefirst' || id === 'mirrormove') return finish(12, id);
  if (id === 'transform') return finish(foeBoosts >= 2 ? 25 : 5, 'transform');
  if (id === 'powersplit' || id === 'guardsplit' || id === 'guardswap' || id === 'powerswap' || id === 'speedswap') return finish(5, id);
  if (id === 'lunardance' || id === 'healingwish') {
    if (side.pokemonLeft < 2 || !((threat.koChance >= 0.5 && pFirst < 1) || myHp < 25)) return finish(-50, id);
    const hurt = side.pokemon.some((p) => alive(p) && p !== me && hpPct(p) < 50);
    return finish(hurt ? 30 : -20, id);
  }
  if (id === 'revivalblessing') {
    // Fails outright without a fainted teammate; otherwise it is worth a turn unless we are about to be KOed first.
    const fainted = side.pokemon.filter((p) => p.fainted).length;
    if (!fainted) return finish(-100, 'revival blessing: nobody to revive');
    return finish(40 + Math.min(2, fainted - 1) * 5, 'revival blessing');
  }

  // Stat-dropping moves aimed at the foe (Growl, Charm, Screech, Fake Tears, …).
  if (targetsFoe(move) && move.boosts) {
    if (STAT_DROP_IMMUNE.has(foe.ability)) return finish(-30, 'foe ignores stat drops');
    let v = 0;
    for (const [stat, amount] of Object.entries(move.boosts)) {
      if (typeof amount !== 'number' || amount >= 0) continue;
      const cur = foe.boosts[stat as keyof typeof foe.boosts] ?? 0;
      if (cur <= -2) continue;
      const n = -amount;
      switch (stat) {
        case 'atk':
          v += n * (threat.category === 'Physical' ? 9 : 3);
          break;
        case 'spa':
          v += n * (threat.category === 'Special' ? 9 : 3);
          break;
        case 'def':
          v += n * (myThreat.moveId && battle.dex.moves.get(myThreat.moveId).category === 'Physical' ? 5 : 2);
          break;
        case 'spd':
          v += n * (myThreat.moveId && battle.dex.moves.get(myThreat.moveId).category === 'Special' ? 5 : 2);
          break;
        case 'spe':
          v += n * (pFirstNoPrio < 1 ? 7 : 2);
          break;
        default:
          v += n * 2;
      }
    }
    return finish(Math.min(35, v) * acc, 'stat drop');
  }

  return finish(targetsFoe(move) ? 10 : 6, 'generic status move');
}

/** Value of a self-boosting move. Returns [score, detail]. */
function setupValue(env: Env, mc: MoveContext, move: Move, boosts: Partial<Record<string, number>>, pFirstNoPrio: number, canKO: boolean): [number, string, Partial<MoveEval>] {
  const { battle } = env;
  const { me, foe, threat } = mc;
  const physicalMoves = me.moveSlots.filter((s) => battle.dex.moves.get(s.id).category === 'Physical').length;
  const specialMoves = me.moveSlots.filter((s) => battle.dex.moves.get(s.id).category === 'Special').length;
  const weights: Record<string, number> = {
    atk: physicalMoves ? 1 : 0.1,
    spa: specialMoves ? 1 : 0.1,
    spe: pFirstNoPrio < 1 ? 0.8 : 0.25,
    def: threat.category === 'Physical' ? 0.6 : 0.2,
    spd: threat.category === 'Special' ? 0.6 : 0.2,
    accuracy: 0.2,
    evasion: 0.4,
  };
  if (me.hasAbility('contrary')) return [-40, 'Contrary inverts boosts', {}];
  let value = 0;
  let primary: string | null = null;
  let primaryWeight = -1;
  for (const [stat, amount] of Object.entries(boosts)) {
    if (typeof amount !== 'number') continue;
    const w = weights[stat] ?? 0.2;
    if (amount > 0) {
      value += amount * w;
      if (w > primaryWeight) {
        primaryWeight = w;
        primary = stat;
      }
    } else value += amount * 0.15;
  }
  if (!primary) return [5, 'no useful boost', {}];
  const current = me.boosts[primary as keyof typeof me.boosts] ?? 0;
  if (current >= 6) return [-20, 'already maxed', {}];
  if (current >= 2) return [8, `already at +${current} ${primary}`, {}];

  const foeHelpless = foe.status === 'slp' || foe.status === 'frz' || !!foe.volatiles['mustrecharge'] || !threat.hasDamaging;
  const safe = foeHelpless || (hpPct(me) > 60 && threat.maxPct < 45);
  let score: number;
  if (!safe) score = Math.max(0, value * 4);
  else score = 50 + 12 * Math.min(value, 2.5);
  if (foeHelpless) score += 10;
  if (canKO) score *= 0.6;
  if (hasMove(foe, PHAZE_IDS) || foe.hasAbility('unaware')) score *= 0.7;
  if (me.volatiles['substitute']) score += 5;
  if (move.flags.charge && !me.hasItem('powerherb')) score *= 0.4;
  if (foe.hasAbility('unaware')) score *= 0.5;
  return [score, `setup (${safe ? 'safe' : 'unsafe'}, value ${value.toFixed(1)})`, { longTerm: true }];
}

/** Score a single move (damaging or status) in context. */
export function scoreMove(env: Env, moveId: string, mc: MoveContext): MoveEval {
  // Nature Power is scored as the attack it calls on the current terrain (Tri Attack by default).
  const move = evaluatedMove(env.battle, moveId);
  if (!move.exists) return blank(0, 'unknown move');
  if (!alive(mc.foe)) return blank(move.category === 'Status' ? 5 : 10 + move.basePower / 10, 'no foe');
  if (move.category === 'Status') {
    if (mc.useZ) return blank(NEVER, 'status Z-move');
    return scoreStatusMove(env, move, mc);
  }
  return scoreDamagingMove(env, move, mc);
}

interface InternalAction extends ScoredAction {
  evaluation?: MoveEval;
  candidate?: SwitchCandidate;
  forme?: FormeOverride;
}

function makeEnv(ctx: AIContext, difficulty: Difficulty): Env {
  return { battle: ctx.battle, side: ctx.side, dmg: new DamageModel(ctx.battle), difficulty, prng: ctx.prng };
}

/**
 * Score every legal choice for the request in `ctx`. The result is sorted best-first and the first entry is
 * what `choose` returns. Difficulty comes from `ctx.difficulty`.
 */
export function scoreActions(ctx: AIContext): ScoredAction[] {
  const difficulty = ctx.difficulty;
  const request = ctx.request;
  const legal = listLegalChoices(request);
  if (!legal.length) return [];
  const env = makeEnv(ctx, difficulty);
  const { side } = env;

  if (request.teamPreview) return legal.map((choice) => ({ choice, score: 0, kind: 'team' as const, detail: 'team preview' }));

  const foe = pickFoe(side);

  if (request.forceSwitch) {
    // After Revival Blessing the "switch" picks which FAINTED Pokémon to revive (it stays on the bench).
    const switches = isRevivingRequest(request) ? scoreRevivalTargets(env, legal, foe) : scoreForcedSwitches(env, legal, foe);
    const actions: ScoredAction[] = switches.map((c) => ({ choice: c.choice, score: c.score, kind: 'switch', detail: c.detail }));
    if (legal.includes('pass')) actions.push({ choice: 'pass', score: NEVER, kind: 'pass', detail: 'pass' });
    return sortActions(actions);
  }

  const moveRequest = request as MoveRequest;
  const active = moveRequest.active?.[0];
  const me = side.active[0];
  if (!active || !me || !foe) {
    return sortActions(legal.map((choice, i) => ({ choice, score: -i, kind: choice.startsWith('switch') ? ('switch' as const) : ('move' as const), detail: 'fallback' })));
  }

  // Shadow Tag / Arena Trap: the engine refuses the switch and only then marks the request as trapped, so treat
  // `maybeTrapped` as trapped and never offer a switch the sim would reject.
  const switchable = !active.trapped && !active.maybeTrapped;
  const usable = switchable ? legal : legal.filter((c) => !c.startsWith('switch '));
  const legalSet = new Set(usable);
  const threat = analyzeThreat(env, foe, me, { includeStab: true });
  const myThreat = analyzeThreat(env, me, foe, { includeStab: false });
  const actions: InternalAction[] = [];

  // Base moves.
  const baseEvals: (MoveEval | null)[] = active.moves.map((m, i) => {
    if (!legalSet.has(`move ${i + 1}`)) return null;
    return scoreMove(env, m.id, { me, foe, threat, myThreat });
  });
  baseEvals.forEach((ev, i) => {
    if (!ev) return;
    actions.push({ choice: `move ${i + 1}`, score: ev.score, kind: 'move', detail: ev.detail, evaluation: ev });
  });

  // Mega Evolution and Ultra Burst: every move gets a variant evaluated as the new forme.
  const formeVariants = (suffix: 'mega' | 'ultra', forme: FormeOverride) => {
    const threatForme = analyzeThreat(env, foe, me, { includeStab: true, defenderForme: forme });
    const myThreatForme = analyzeThreat(env, me, foe, { includeStab: false, attackerForme: forme });
    active.moves.forEach((m, i) => {
      const choice = `move ${i + 1} ${suffix}`;
      if (!legalSet.has(choice)) return;
      const base = baseEvals[i];
      if (difficulty === 'normal') {
        actions.push({ choice, score: (base?.score ?? 0) - 0.5, kind: 'move', detail: `${suffix} (normal AI ignores)`, evaluation: base ?? undefined, forme });
        return;
      }
      const ev = scoreMove(env, m.id, { me, foe, threat: threatForme, myThreat: myThreatForme, forme });
      actions.push({ choice, score: ev.score + MEGA_BONUS, kind: 'move', detail: `${suffix}: ${ev.detail}`, evaluation: ev, forme });
    });
  };
  const megaSpecies = me.canMegaEvo || me.canMegaEvoX || me.canMegaEvoY;
  const forme = megaSpecies && (active.canMegaEvo || active.canMegaEvoX || active.canMegaEvoY) ? megaForme(env, megaSpecies) : null;
  if (forme) formeVariants('mega', forme);
  const ultraForme = me.canUltraBurst && active.canUltraBurst ? megaForme(env, me.canUltraBurst) : null;
  if (ultraForme) formeVariants('ultra', ultraForme);

  // Z-Moves: only when the Z version of the best base move would KO or deal ≥ 60 %.
  let bestBaseIndex = -1;
  let bestBaseScore = -Infinity;
  baseEvals.forEach((ev, i) => {
    if (ev && ev.score > bestBaseScore) {
      bestBaseScore = ev.score;
      bestBaseIndex = i;
    }
  });
  active.moves.forEach((m, i) => {
    const choice = `move ${i + 1} zmove`;
    if (!legalSet.has(choice)) return;
    let score = NEVER;
    let detail = 'z-move not worth it';
    if (i === bestBaseIndex && difficulty !== 'normal') {
      const move = env.battle.dex.moves.get(m.id);
      if (move.category !== 'Status') {
        const est = env.dmg.estimate(me, foe, m.id, { useZ: true });
        if (est.koChance >= 0.5 || est.maxPct >= 60) {
          const ev = scoreMove(env, m.id, { me, foe, threat, myThreat, useZ: true });
          score = Math.max(bestBaseScore, ev.score) + 5;
          detail = `z-move: ${ev.detail}`;
        }
      }
    }
    actions.push({ choice, score, kind: 'move', detail });
  });

  // Terastallization (only in formats that allow it): never preferred over the plain move.
  active.moves.forEach((_m, i) => {
    const choice = `move ${i + 1} terastallize`;
    if (!legalSet.has(choice)) return;
    actions.push({ choice, score: (baseEvals[i]?.score ?? 0) - 0.5, kind: 'move', detail: 'terastallize (not used)' });
  });

  // Voluntary switches (hard / champion only).
  if (difficulty !== 'normal' && switchable) {
    const bestDamaging = myThreat.moveId ? env.battle.dex.moves.get(myThreat.moveId) : null;
    const pFirstBest = bestDamaging ? movesFirstProb(me, foe, effectivePriority(env, me, bestDamaging), threat.priority) : speedOrderProb(me, foe);
    const lockedMoveId = me.volatiles['choicelock']?.move as string | undefined;
    let lockedIntoBadMove = false;
    if (lockedMoveId) {
      const locked = env.battle.dex.moves.get(lockedMoveId);
      if (locked.exists) {
        lockedIntoBadMove = locked.category === 'Status' ? false : isImmune(env.battle, locked, me, foe) || typeEffectiveness(env.battle, resolveMoveType(env.battle, locked, me), foe) < 0;
      }
    }
    const switches = scoreVoluntarySwitches(env, usable, { me, foe, threat, myThreat, pFirstBest, lockedIntoBadMove });
    for (const c of switches) actions.push({ choice: c.choice, score: c.score, kind: 'switch', detail: c.detail, candidate: c });
  } else {
    for (const choice of usable) {
      if (choice.startsWith('switch ')) actions.push({ choice, score: NEVER, kind: 'switch', detail: 'voluntary switches disabled' });
    }
  }

  if (difficulty === 'champion') applyLookahead(env, actions, me, foe, threat);
  if (difficulty === 'normal') applyNoise(env, actions, usable);

  return sortActions(actions.map(({ choice, score, kind, detail }) => ({ choice, score, kind, detail })));
}

/** Champion: subtract the foe's best reply after each action and bias toward long-term value when safe. */
function applyLookahead(env: Env, actions: InternalAction[], me: Pokemon, foe: Pokemon, threat: Threat): void {
  for (const a of actions) {
    if (a.score <= NEVER) continue;
    if (a.kind === 'switch' && a.candidate) {
      const reply = a.candidate.matchup.incoming;
      a.score -= Math.min(100, reply.expectedPct) * 0.25;
      a.detail += ` | reply −${(Math.min(100, reply.expectedPct) * 0.25).toFixed(0)}`;
      continue;
    }
    const ev = a.evaluation;
    if (!ev) continue;
    const replyThreat = a.forme ? analyzeThreat(env, foe, me, { includeStab: true, defenderForme: a.forme }) : threat;
    const pFirst = movesFirstProb(me, foe, ev.priority, replyThreat.priority);
    // The foe replies unless we KO it first.
    const pReply = 1 - pFirst * ev.koChance;
    let penalty = Math.min(100, replyThreat.expectedPct) * 0.5 * pReply;
    if (ev.protect) penalty = 0;
    else if (ev.recovery) penalty *= 0.2;
    else if (ev.pivot) penalty *= 0.5;
    let bonus = 0;
    if (ev.longTerm && replyThreat.maxPct < 45 && ev.score > 0) bonus = ev.score * 0.1;
    a.score = a.score - penalty + bonus;
    a.detail += ` | reply −${penalty.toFixed(0)}${bonus ? ` +${bonus.toFixed(0)} long-term` : ''}`;
  }
}

/**
 * Normal: multiply scores by noise in [0.7, 1.3]; with 15 % probability pick a uniformly random legal move.
 * A move and its mega / Z / tera variants share one noise roll so the variants keep their fixed offset below the
 * plain move (normal never mega evolves on purpose).
 */
function applyNoise(env: Env, actions: InternalAction[], legal: readonly string[]): void {
  const { prng } = env;
  const rolls = new Map<string, number>();
  for (const a of actions) {
    if (a.score <= NEVER) continue;
    const key = a.choice.split(' ').slice(0, 2).join(' ');
    let noise = rolls.get(key);
    if (noise === undefined) {
      noise = 0.7 + prng.random() * 0.6;
      rolls.set(key, noise);
    }
    a.score *= noise;
  }
  if (prng.randomChance(15, 100)) {
    const moves = legal.filter((c) => /^move \d+$/.test(c));
    if (moves.length) {
      const pick = prng.sample(moves);
      const action = actions.find((a) => a.choice === pick);
      if (action) {
        action.score = 10_000;
        action.detail = `random pick (${action.detail})`;
      }
    }
  }
}

function sortActions<T extends ScoredAction>(actions: T[]): T[] {
  return actions
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.score - x.a.score || x.i - y.i)
    .map(({ a }) => a);
}

export { NO_THREAT };
