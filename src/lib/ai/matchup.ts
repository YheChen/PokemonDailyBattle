/**
 * Matchup scoring for switches (voluntary and forced) and Revival Blessing targets.
 *
 * Bench Pokémon are read through the bench-safe accessors of `damage.ts` (`hasItemNow`, `hasAbilityNow`,
 * `isGroundedNow`): the sim reports no item / no ability / grounded for every inactive Pokémon.
 */
import type { Pokemon } from '@pkmn/sim';
import { hasAbilityNow, hasItemNow, isGroundedNow, typeEffectiveness } from './damage';
import { NO_THREAT, alive, analyzeThreat, speedOrderProb, type Env, type Threat } from './threat';

export interface EntryHazards {
  /** Damage taken on entry as % of max HP. */
  pct: number;
  /** Entering absorbs the foe's Toxic Spikes (grounded Poison type). */
  absorbsToxicSpikes: boolean;
  /** Entering gets the Pokémon poisoned. */
  poisoned: boolean;
  /** Entering drops its speed (Sticky Web). */
  webbed: boolean;
}

export function entryHazards(env: Env, p: Pokemon): EntryHazards {
  const sc = p.side.sideConditions;
  const out: EntryHazards = { pct: 0, absorbsToxicSpikes: false, poisoned: false, webbed: false };
  if (hasItemNow(p, 'heavydutyboots')) return out;
  const magicGuard = hasAbilityNow(p, 'magicguard');
  const grounded = !!isGroundedNow(p);
  if (sc['stealthrock'] && !magicGuard) {
    const eff = typeEffectiveness(env.battle, 'Rock', p);
    out.pct += 12.5 * Math.pow(2, Math.max(-2, Math.min(2, eff)));
  }
  if (sc['gmaxsteelsurge'] && !magicGuard) {
    const eff = typeEffectiveness(env.battle, 'Steel', p);
    out.pct += 12.5 * Math.pow(2, Math.max(-2, Math.min(2, eff)));
  }
  if (grounded) {
    if (sc['spikes'] && !magicGuard) {
      const layers = Number(sc['spikes'].layers ?? 1);
      out.pct += layers >= 3 ? 25 : layers === 2 ? 100 / 6 : 12.5;
    }
    if (sc['toxicspikes']) {
      if (p.hasType('Poison')) out.absorbsToxicSpikes = true;
      else if (!p.hasType('Steel') && !p.status && !hasAbilityNow(p, 'immunity')) out.poisoned = true;
    }
    if (sc['stickyweb']) out.webbed = true;
  }
  return out;
}

export interface Matchup {
  defensive: number;
  offensive: number;
  hazardPct: number;
  total: number;
  incoming: Threat;
  outgoing: Threat;
  detail: string;
}

const DEAD_MATCHUP = -1000;

/**
 * How good is `candidate` against `foe`? Defensive score = 100 − worst incoming hit (% of HP after hazards),
 * offensive score = best expected damage vs the foe (+ KO bonus). Total = 0.6 × defensive + 0.4 × offensive.
 */
export function matchupScore(env: Env, candidate: Pokemon, foe: Pokemon | null, opts: { onEntry?: boolean } = {}): Matchup {
  const hazards = opts.onEntry ? entryHazards(env, candidate) : { pct: 0, absorbsToxicSpikes: false, poisoned: false, webbed: false };
  const hazardHp = (hazards.pct / 100) * candidate.maxhp;
  const hpAfter = candidate.hp - hazardHp;
  if (!alive(candidate) || hpAfter <= 0) {
    return { defensive: -100, offensive: 0, hazardPct: hazards.pct, total: DEAD_MATCHUP, incoming: { ...NO_THREAT }, outgoing: { ...NO_THREAT }, detail: 'would faint on entry' };
  }
  if (!foe || !alive(foe)) {
    const total = 20 + (candidate.hp / candidate.maxhp) * 30 - hazards.pct * 0.5;
    return { defensive: 50, offensive: 50, hazardPct: hazards.pct, total, incoming: { ...NO_THREAT }, outgoing: { ...NO_THREAT }, detail: 'no foe' };
  }

  const incoming = analyzeThreat(env, foe, candidate, { includeStab: true });
  // Rescale the incoming max hit to the HP the candidate will have after hazards.
  const worstHp = (incoming.maxPct / 100) * candidate.hp;
  const worstPct = (worstHp / hpAfter) * 100;
  const defensive = Math.max(-50, Math.min(100, 100 - worstPct));

  const outgoing = analyzeThreat(env, candidate, foe, { includeStab: false });
  let offensive = Math.min(120, outgoing.expectedPct + outgoing.koChance * 30);
  if (speedOrderProb(candidate, foe) >= 0.5 && outgoing.expectedPct > 0) offensive += 8;

  let total = 0.6 * defensive + 0.4 * offensive - hazards.pct * 0.5;
  if (hazards.poisoned) total -= 8;
  if (hazards.absorbsToxicSpikes) total += 6;
  if (hazards.webbed) total -= 4;
  if (hasAbilityNow(candidate, 'regenerator')) total += 5;
  if (candidate.status) total -= 5;
  if (hasAbilityNow(candidate, 'intimidate') && incoming.category === 'Physical') total += 6;

  const detail = `def ${defensive.toFixed(0)} (worst ${worstPct.toFixed(0)}%), off ${offensive.toFixed(0)}, hazards ${hazards.pct.toFixed(0)}%`;
  return { defensive, offensive, hazardPct: hazards.pct, total, incoming, outgoing, detail };
}


export interface SwitchCandidate {
  choice: string;
  index: number;
  pokemon: Pokemon;
  matchup: Matchup;
  score: number;
  detail: string;
}

/** Parse the `switch N` entries of a legal-choice list into bench Pokémon. */
export function switchCandidates(env: Env, legal: readonly string[]): { choice: string; index: number; pokemon: Pokemon }[] {
  const out: { choice: string; index: number; pokemon: Pokemon }[] = [];
  for (const choice of legal) {
    const m = /^switch (\d+)$/.exec(choice);
    if (!m) continue;
    const index = Number(m[1]) - 1;
    const pokemon = env.side.pokemon[index];
    if (!pokemon) continue;
    out.push({ choice, index, pokemon });
  }
  return out;
}

/** Forced switch (after a faint / U-turn): best matchup, hazard-aware. */
export function scoreForcedSwitches(env: Env, legal: readonly string[], foe: Pokemon | null): SwitchCandidate[] {
  return switchCandidates(env, legal).map(({ choice, index, pokemon }) => {
    const matchup = matchupScore(env, pokemon, foe, { onEntry: true });
    return { choice, index, pokemon, matchup, score: matchup.total, detail: `forced switch: ${matchup.detail}` };
  });
}

/**
 * Revival Blessing targets: `legal` holds `switch N` for the FAINTED bench members and the chosen one comes back
 * at half HP on the bench. A fainted Pokémon has no live damage numbers, so the candidates are ranked by
 * type matchup against the current foe (STAB offence, worst incoming STAB), base-stat total, remaining usable
 * PP and the hazards it will later have to switch into.
 */
export function scoreRevivalTargets(env: Env, legal: readonly string[], foe: Pokemon | null): SwitchCandidate[] {
  const { battle } = env;
  const clamp = (v: number) => Math.max(-2, Math.min(2, v));
  return switchCandidates(env, legal).map(({ choice, index, pokemon }) => {
    const myTypes = pokemon.getTypes().filter((t) => t !== '???');
    let offensive = 0;
    let defensive = 0;
    if (foe && alive(foe)) {
      offensive = Math.max(...myTypes.map((t) => clamp(typeEffectiveness(battle, t, foe))));
      defensive = -Math.max(...foe.getTypes().filter((t) => t !== '???').map((t) => clamp(typeEffectiveness(battle, t, pokemon))));
    }
    const bst = Object.values(pokemon.species.baseStats).reduce((a, b) => a + b, 0);
    const usablePp = pokemon.moveSlots.reduce((n, s) => n + (s.pp > 0 ? 1 : 0), 0);
    const hazards = entryHazards(env, pokemon);
    let score = 30 + offensive * 10 + defensive * 10 + (bst - 450) / 10 - hazards.pct * 0.3;
    if (hazards.poisoned) score -= 5;
    if (usablePp === 0) score -= 40;
    const detail = `revive: ${myTypes.join('/')} off ${offensive >= 0 ? '+' : ''}${offensive} def ${defensive >= 0 ? '+' : ''}${defensive}, BST ${bst}, hazards ${hazards.pct.toFixed(0)}%`;
    const matchup: Matchup = { defensive, offensive, hazardPct: hazards.pct, total: score, incoming: { ...NO_THREAT }, outgoing: { ...NO_THREAT }, detail };
    return { choice, index, pokemon, matchup, score, detail };
  });
}

export interface VoluntarySwitchInput {
  me: Pokemon;
  foe: Pokemon;
  /** Foe's best option against the active Pokémon. */
  threat: Threat;
  /** Active Pokémon's best damaging option (accuracy weighted). */
  myThreat: Threat;
  /** Probability that the active Pokémon's best move goes before the foe's best move. */
  pFirstBest: number;
  /** Choice-locked into a move the foe resists or is immune to. */
  lockedIntoBadMove: boolean;
}

/**
 * Voluntary switch scores (hard/champion). Returns a very negative score when switching is not warranted so the
 * choice stays legal but is never preferred over a move.
 */
export function scoreVoluntarySwitches(env: Env, legal: readonly string[], input: VoluntarySwitchInput): SwitchCandidate[] {
  const { me, foe, threat, myThreat, pFirstBest, lockedIntoBadMove } = input;
  const candidates = switchCandidates(env, legal);
  if (!candidates.length) return [];

  const threatened = threat.koChance >= 0.5;
  const canKOFirst = myThreat.koChance >= 0.5 && pFirstBest >= 0.5;
  const noDamage = myThreat.expectedPct <= 10;
  const reason = threatened && !canKOFirst ? 'threatened' : lockedIntoBadMove ? 'choice-locked' : noDamage ? 'no damage' : null;

  if (!reason) {
    return candidates.map((c) => ({ ...c, matchup: matchupScore(env, c.pokemon, foe, { onEntry: true }), score: DEAD_MATCHUP, detail: 'no reason to switch' }));
  }

  const active = matchupScore(env, me, foe);
  const margin = reason === 'threatened' ? 15 : 10;
  return candidates.map((c) => {
    const matchup = matchupScore(env, c.pokemon, foe, { onEntry: true });
    if (matchup.total <= DEAD_MATCHUP) return { ...c, matchup, score: DEAD_MATCHUP, detail: 'would faint on entry' };
    const diff = matchup.total - active.total;
    if (diff <= margin) return { ...c, matchup, score: DEAD_MATCHUP, detail: `${reason}: not a better matchup (${diff.toFixed(0)})` };
    let score = 40 + diff * 0.6;
    if (reason !== 'threatened') score += 10;
    if (hasAbilityNow(me, 'regenerator')) score += 5;
    return { ...c, matchup, score, detail: `${reason}: ${matchup.detail} (+${diff.toFixed(0)} vs active)` };
  });
}
