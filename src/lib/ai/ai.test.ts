import { beforeAll, describe, expect, it } from 'vitest';
import type { Battle as SimBattle, ID, PokemonSet, PRNG as SimPRNG, Side as SimSide } from '@pkmn/sim';
import { DEFAULT_FORMAT, type Difficulty, type MoveRequest, type OpponentAgent } from '@/lib/battle/types';
import { isRevivingRequest, listLegalChoices } from '@/lib/battle/legal';
import { createOpponentAI, scoreActions, DamageModel } from './index';
import { isGroundedNow, isImmune, resolveMove } from './damage';
import { entryHazards, matchupScore } from './matchup';

type Sim = typeof import('@pkmn/sim');
type Randoms = typeof import('@pkmn/randoms');
type Seed = `${number},${string}`;

let sim: Sim;
let randoms: Randoms;

beforeAll(async () => {
  sim = await import('@pkmn/sim');
  randoms = await import('@pkmn/randoms');
});

const BATTLES_PER_DIFFICULTY = 25;
const MAX_TURNS = 400;

function randomTeam(seed: Seed): PokemonSet[] {
  const generator = randoms.TeamGenerators.getTeamGenerator('gen9randombattle', new sim.PRNG(seed));
  return generator.getTeam().map((set) => ({ ...set, level: 100 }));
}

function newBattle(seed: Seed): SimBattle {
  return new sim.Battle({ formatid: DEFAULT_FORMAT as ID, seed, send: () => {} });
}

interface BattleOutcome {
  winner: string;
  turns: number;
  aiChoiceFailures: number;
  aiDecisions: number;
  totalMs: number;
  stuck: boolean;
}

function pendingRequest(side: SimSide): NonNullable<SimSide['activeRequest']> | null {
  const req = side.activeRequest;
  if (!req || req.wait) return null;
  if (side.isChoiceDone()) return null;
  return req;
}

/** Random-legal-choice player: tries every legal choice in random order until the engine accepts one. */
function chooseRandom(battle: SimBattle, side: SimSide, prng: SimPRNG): void {
  const req = pendingRequest(side);
  if (!req) return;
  const order = listLegalChoices(req);
  prng.shuffle(order);
  for (const choice of order) {
    if (battle.choose(side.id, choice)) return;
  }
  // Nothing accepted: fall back to the engine default so the battle never hangs.
  battle.choose(side.id, 'default');
}

/**
 * Plays one battle to the end: the AI on p2, a random-legal-choice player on p1. Both sides handle forced
 * switches. Returns the outcome plus the AI's choice-rejection count and timing.
 */
function playBattle(seed: Seed, p1Team: PokemonSet[], p2Team: PokemonSet[], agent: OpponentAgent, difficulty: Difficulty): BattleOutcome {
  const battle = newBattle(seed);
  const playerPrng = new sim.PRNG(seed);
  const aiPrng = new sim.PRNG(seed);
  battle.setPlayer('p1', { name: 'Random', team: p1Team });
  battle.setPlayer('p2', { name: 'AI', team: p2Team });
  battle.sendUpdates();

  let aiChoiceFailures = 0;
  let aiDecisions = 0;
  let totalMs = 0;
  let stuck = false;

  for (let guard = 0; !battle.ended && battle.turn <= MAX_TURNS; guard++) {
    if (guard > MAX_TURNS * 8) {
      stuck = true;
      break;
    }
    let acted = false;
    const p1Req = pendingRequest(battle.p1);
    if (p1Req) {
      chooseRandom(battle, battle.p1, playerPrng);
      acted = true;
    }
    const p2Req = pendingRequest(battle.p2);
    if (p2Req) {
      const t0 = performance.now();
      const choice = agent.choose({ battle, side: battle.p2, request: p2Req, prng: aiPrng, difficulty });
      totalMs += performance.now() - t0;
      aiDecisions++;
      const ok = battle.choose('p2', choice);
      if (!ok) {
        aiChoiceFailures++;
        // Keep the battle moving so the remaining assertions still run.
        chooseRandom(battle, battle.p2, aiPrng);
      }
      acted = true;
    }
    battle.sendUpdates();
    if (!acted) {
      stuck = true;
      break;
    }
  }

  return { winner: battle.winner ?? '', turns: battle.turn, aiChoiceFailures, aiDecisions, totalMs, stuck };
}

function runSeries(difficulty: Difficulty): { wins: number; outcomes: BattleOutcome[] } {
  const agent = createOpponentAI(difficulty, { strict: true });
  const outcomes: BattleOutcome[] = [];
  let wins = 0;
  for (let i = 0; i < BATTLES_PER_DIFFICULTY; i++) {
    const seedA: Seed = `${i + 1},${i * 7 + 3},${i * 13 + 5},${i * 17 + 11}`;
    const seedB: Seed = `${i + 101},${i * 5 + 9},${i * 11 + 7},${i * 19 + 13}`;
    const teamA = randomTeam(seedA);
    const teamB = randomTeam(seedB);
    // Alternate which generated team goes to which side so team quality does not bias the result.
    const [p1Team, p2Team] = i % 2 === 0 ? [teamA, teamB] : [teamB, teamA];
    const battleSeed: Seed = `${i + 1},${i + 2},${i + 3},${i + 4}`;
    const outcome = playBattle(battleSeed, p1Team, p2Team, agent, difficulty);
    outcomes.push(outcome);
    if (outcome.winner === 'AI') wins++;
  }
  return { wins, outcomes };
}

// ---------------------------------------------------------------------------------------------------------------
// Hand-built scenario helpers
// ---------------------------------------------------------------------------------------------------------------

const ZERO_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const MAX_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function set(partial: Partial<PokemonSet> & { species: string; moves: string[]; ability: string }): PokemonSet {
  return {
    name: partial.species,
    item: '',
    nature: 'Hardy',
    evs: { ...ZERO_EVS },
    ivs: { ...MAX_IVS },
    level: 100,
    gender: 'M',
    ...partial,
  } as PokemonSet;
}

interface Scenario {
  battle: SimBattle;
  request: NonNullable<SimSide['activeRequest']>;
  prng: SimPRNG;
}

/** Starts a battle with the AI on p2 and returns p2's first request. */
function scenario(p1Team: PokemonSet[], p2Team: PokemonSet[], seed: Seed = '1,2,3,4', mutate?: (battle: SimBattle) => void): Scenario {
  const battle = newBattle(seed);
  battle.setPlayer('p1', { name: 'Player', team: p1Team });
  battle.setPlayer('p2', { name: 'AI', team: p2Team });
  battle.sendUpdates();
  mutate?.(battle);
  const request = battle.p2.activeRequest;
  if (!request) throw new Error('p2 has no request');
  return { battle, request, prng: new sim.PRNG(seed) };
}

function choose(sc: Scenario, difficulty: Difficulty): string {
  return createOpponentAI(difficulty, { strict: true }).choose({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng: sc.prng, difficulty });
}

function scores(sc: Scenario, difficulty: Difficulty) {
  return scoreActions({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng: sc.prng, difficulty });
}

function asMoveRequest(sc: Scenario): MoveRequest {
  const req = sc.request;
  if (!('active' in req) || !req.active) throw new Error('not a move request');
  return req as MoveRequest;
}

function moveIndex(sc: Scenario, moveName: string): number {
  const req = asMoveRequest(sc);
  const idx = req.active[0].moves.findIndex((m) => m.move === moveName || m.id === moveName.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (idx < 0) throw new Error(`move ${moveName} not in request`);
  return idx + 1;
}

function scoreOf(sc: Scenario, difficulty: Difficulty, choice: string): number {
  const action = scores(sc, difficulty).find((a) => a.choice === choice);
  if (!action) throw new Error(`choice ${choice} not scored`);
  return action.score;
}

const GYARADOS = set({
  species: 'Gyarados', ability: 'Intimidate', item: 'Life Orb', nature: 'Adamant',
  moves: ['Waterfall', 'Earthquake', 'Ice Fang', 'Dragon Dance'], evs: { ...ZERO_EVS, atk: 252, spe: 252, hp: 4 },
});
const CHARIZARD = set({
  species: 'Charizard', ability: 'Blaze', item: 'Heavy-Duty Boots', nature: 'Timid',
  moves: ['Flamethrower', 'Air Slash', 'Dragon Pulse', 'Roost'], evs: { ...ZERO_EVS, spa: 252, spe: 252, hp: 4 },
});
const DONPHAN = set({
  species: 'Donphan', ability: 'Sturdy', item: 'Leftovers', nature: 'Impish',
  moves: ['Earthquake', 'Knock Off', 'Rapid Spin', 'Stealth Rock'], evs: { ...ZERO_EVS, hp: 252, def: 252, atk: 4 },
});
const JOLTEON = set({
  species: 'Jolteon', ability: 'Volt Absorb', item: 'Choice Specs', nature: 'Timid',
  moves: ['Thunder Wave', 'Thunderbolt', 'Shadow Ball', 'Volt Switch'], evs: { ...ZERO_EVS, spa: 252, spe: 252, hp: 4 },
});
const BLISSEY = set({
  species: 'Blissey', ability: 'Natural Cure', item: 'Leftovers', nature: 'Bold', gender: 'F',
  moves: ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Stealth Rock'], evs: { ...ZERO_EVS, hp: 252, def: 252, spd: 4 },
});
const FERROTHORN = set({
  species: 'Ferrothorn', ability: 'Iron Barbs', item: 'Leftovers', nature: 'Impish',
  moves: ['Leech Seed', 'Gyro Ball', 'Protect', 'Knock Off'], evs: { ...ZERO_EVS, hp: 252, def: 252, spd: 4 },
});
const SCIZOR = set({
  species: 'Scizor', ability: 'Technician', item: 'Life Orb', nature: 'Adamant',
  moves: ['Bullet Punch', 'U-turn', 'Swords Dance', 'Knock Off'], evs: { ...ZERO_EVS, atk: 252, hp: 252, spd: 4 },
});
const TYRANITAR = set({
  species: 'Tyranitar', ability: 'Sand Stream', item: 'Leftovers', nature: 'Adamant',
  moves: ['Stone Edge', 'Crunch', 'Earthquake', 'Stealth Rock'], evs: { ...ZERO_EVS, hp: 252, atk: 252, spd: 4 },
});
const HEATRAN = set({
  species: 'Heatran', ability: 'Flash Fire', item: 'Leftovers', nature: 'Calm',
  moves: ['Magma Storm', 'Earth Power', 'Taunt', 'Stealth Rock'], evs: { ...ZERO_EVS, hp: 252, spd: 252, spe: 4 },
});
const GARDEVOIR = set({
  species: 'Gardevoir', ability: 'Trace', item: 'Gardevoirite', nature: 'Timid', gender: 'F',
  moves: ['Moonblast', 'Psyshock', 'Focus Blast', 'Calm Mind'], evs: { ...ZERO_EVS, spa: 252, spe: 252, hp: 4 },
});
const GENGAR = set({
  species: 'Gengar', ability: 'Cursed Body', item: 'Life Orb', nature: 'Timid',
  moves: ['Shadow Ball', 'Sludge Bomb', 'Thunderbolt', 'Focus Blast'], evs: { ...ZERO_EVS, spa: 252, spe: 252, hp: 4 },
});
const EXCADRILL = set({
  species: 'Excadrill', ability: 'Mold Breaker', item: 'Leftovers', nature: 'Jolly',
  moves: ['Earthquake', 'Iron Head', 'Rapid Spin', 'Swords Dance'], evs: { ...ZERO_EVS, atk: 252, spe: 252, hp: 4 },
});
const SNORLAX = set({
  species: 'Snorlax', ability: 'Thick Fat', item: 'Leftovers', nature: 'Adamant',
  moves: ['Body Slam', 'Superpower', 'Crunch', 'Rest'], evs: { ...ZERO_EVS, hp: 252, atk: 252, spd: 4 },
});

// ---------------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------------

describe('createOpponentAI – seeded battles vs a random player', () => {
  const results: Partial<Record<Difficulty, ReturnType<typeof runSeries>>> = {};

  for (const difficulty of ['normal', 'hard', 'champion'] as const) {
    it(`${difficulty}: every AI choice is accepted and every battle ends within ${MAX_TURNS} turns`, () => {
      const series = runSeries(difficulty);
      results[difficulty] = series;
      const failures = series.outcomes.reduce((n, o) => n + o.aiChoiceFailures, 0);
      const decisions = series.outcomes.reduce((n, o) => n + o.aiDecisions, 0);
      const ms = series.outcomes.reduce((n, o) => n + o.totalMs, 0);
      const maxTurns = Math.max(...series.outcomes.map((o) => o.turns));
      console.log(
        `[ai] ${difficulty}: ${series.wins}/${BATTLES_PER_DIFFICULTY} wins, ${failures} rejected choices, ${decisions} decisions, ` +
          `${(ms / Math.max(1, decisions)).toFixed(2)} ms/decision, longest battle ${maxTurns} turns`,
      );
      expect(failures).toBe(0);
      expect(decisions).toBeGreaterThan(0);
      for (const o of series.outcomes) {
        expect(o.stuck).toBe(false);
        expect(o.turns).toBeLessThanOrEqual(MAX_TURNS);
        expect(o.winner === 'AI' || o.winner === 'Random' || o.winner === '').toBe(true);
      }
    });
  }

  it('hard wins at least 20 of 25', () => {
    const series = results.hard ?? runSeries('hard');
    expect(series.wins).toBeGreaterThanOrEqual(20);
  });

  it('champion wins at least 20 of 25', () => {
    const series = results.champion ?? runSeries('champion');
    expect(series.wins).toBeGreaterThanOrEqual(20);
  });

  it('normal wins at least 12 of 25', () => {
    const series = results.normal ?? runSeries('normal');
    expect(series.wins).toBeGreaterThanOrEqual(12);
  });
});

describe('createOpponentAI – scenarios', () => {
  it('(a) Gyarados vs Charizard never picks Earthquake (Flying immunity)', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([CHARIZARD], [GYARADOS]);
      const choice = choose(sc, difficulty);
      const waterfall = `move ${moveIndex(sc, 'Waterfall')}`;
      const dragonDance = `move ${moveIndex(sc, 'Dragon Dance')}`;
      const earthquake = `move ${moveIndex(sc, 'Earthquake')}`;
      expect(choice).not.toBe(earthquake);
      expect([waterfall, dragonDance]).toContain(choice);
      expect(scoreOf(sc, difficulty, earthquake)).toBeLessThan(0);
    }
    // normal rolls dice, but the Earthquake score itself must still be an immunity penalty.
    const sc = scenario([CHARIZARD], [GYARADOS]);
    const earthquake = `move ${moveIndex(sc, 'Earthquake')}`;
    expect(scoreOf(sc, 'hard', earthquake)).toBeLessThanOrEqual(-50);
  });

  it('(b) never picks Thunder Wave against a pure Ground type', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([DONPHAN], [JOLTEON]);
      const thunderWave = `move ${moveIndex(sc, 'Thunder Wave')}`;
      const thunderbolt = `move ${moveIndex(sc, 'Thunderbolt')}`;
      const voltSwitch = `move ${moveIndex(sc, 'Volt Switch')}`;
      const choice = choose(sc, difficulty);
      expect(choice).not.toBe(thunderWave);
      expect(choice).not.toBe(thunderbolt);
      expect(choice).not.toBe(voltSwitch);
      expect(choice).toBe(`move ${moveIndex(sc, 'Shadow Ball')}`);
      expect(scoreOf(sc, difficulty, thunderWave)).toBeLessThanOrEqual(-40);
    }
    // Even normal (noisy) never promotes an immune status move above the random-pick threshold.
    const sc = scenario([DONPHAN], [JOLTEON]);
    const thunderWave = `move ${moveIndex(sc, 'Thunder Wave')}`;
    for (let i = 0; i < 20; i++) {
      const prng = new sim.PRNG(`${i + 1},${i + 2},${i + 3},${i + 4}`);
      const agent = createOpponentAI('normal', { strict: true });
      const choice = agent.choose({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng, difficulty: 'normal' });
      if (choice === thunderWave) {
        // Only the 15 % uniform random pick can land here; make sure the scored value itself is still negative.
        expect(scoreOf(sc, 'hard', thunderWave)).toBeLessThan(0);
      }
    }
  });

  it('(c) Blissey at 30 % HP picks Soft-Boiled', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([FERROTHORN], [BLISSEY], '5,6,7,8', (battle) => {
        const blissey = battle.p2.active[0]!;
        blissey.sethp(Math.floor(blissey.maxhp * 0.3));
      });
      const blissey = sc.battle.p2.active[0]!;
      expect(blissey.hp / blissey.maxhp).toBeLessThan(0.31);
      expect(choose(sc, difficulty)).toBe(`move ${moveIndex(sc, 'Soft-Boiled')}`);
    }
  });

  it('(d) hard: Scizor threatened by Charizard switches to Heatran or Tyranitar', () => {
    const sc = scenario([CHARIZARD], [SCIZOR, TYRANITAR, HEATRAN]);
    const choice = choose(sc, 'hard');
    expect(choice.startsWith('switch ')).toBe(true);
    const index = Number(choice.slice('switch '.length)) - 1;
    const target = sc.request.side.pokemon[index];
    expect(['Heatran', 'Tyranitar']).toContain(target.details.split(',')[0]);
    // Both Fire resists outrank every move of the doomed Scizor.
    const ranked = scores(sc, 'hard');
    expect(ranked[0].choice).toBe(choice);
    expect(ranked[0].kind).toBe('switch');
    expect(ranked[1].kind).toBe('switch');
    expect(ranked[2].kind).toBe('move');
    // Champion agrees.
    expect(choose(sc, 'champion').startsWith('switch ')).toBe(true);
  });

  it('(e) champion: Gardevoir mega evolves on the first available turn', () => {
    const sc = scenario([TYRANITAR], [GARDEVOIR]);
    expect(asMoveRequest(sc).active[0].canMegaEvo).toBe(true);
    const choice = choose(sc, 'champion');
    expect(choice).toContain(' mega');
    // The mega version of every attack outranks its base version.
    const ranked = scores(sc, 'champion');
    for (const name of ['Moonblast', 'Psyshock', 'Focus Blast']) {
      const i = moveIndex(sc, name);
      const base = ranked.find((a) => a.choice === `move ${i}`)!;
      const mega = ranked.find((a) => a.choice === `move ${i} mega`)!;
      expect(mega.score).toBeGreaterThan(base.score);
    }
    // Hard also uses the mega; normal never does.
    expect(choose(sc, 'hard')).toContain(' mega');
    const normalChoices = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const prng = new sim.PRNG(`${i + 2},${i + 3},${i + 4},${i + 5}`);
      normalChoices.add(createOpponentAI('normal', { strict: true }).choose({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng, difficulty: 'normal' }));
    }
    for (const c of normalChoices) expect(c).not.toContain(' mega');
  });

  it('(f) immunity: never picks a move the target is immune to', () => {
    // Gengar vs Excadrill (Ground/Steel): Sludge Bomb and Thunderbolt do nothing.
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([EXCADRILL], [GENGAR]);
      const sludgeBomb = `move ${moveIndex(sc, 'Sludge Bomb')}`;
      const thunderbolt = `move ${moveIndex(sc, 'Thunderbolt')}`;
      const choice = choose(sc, difficulty);
      expect(choice).not.toBe(sludgeBomb);
      expect(choice).not.toBe(thunderbolt);
      expect(scoreOf(sc, difficulty, sludgeBomb)).toBeLessThanOrEqual(-50);
      expect(scoreOf(sc, difficulty, thunderbolt)).toBeLessThanOrEqual(-50);
    }
    // Mirrored: Snorlax vs Gengar (Ghost): Normal and Fighting moves do nothing, Crunch is the answer.
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([GENGAR], [SNORLAX]);
      const bodySlam = `move ${moveIndex(sc, 'Body Slam')}`;
      const superpower = `move ${moveIndex(sc, 'Superpower')}`;
      const crunch = `move ${moveIndex(sc, 'Crunch')}`;
      const choice = choose(sc, difficulty);
      expect(choice).toBe(crunch);
      expect(scoreOf(sc, difficulty, bodySlam)).toBeLessThanOrEqual(-50);
      expect(scoreOf(sc, difficulty, superpower)).toBeLessThanOrEqual(-50);
    }
  });

  it('always returns a legal choice and is deterministic for the same state and PRNG seed', () => {
    const sc = scenario([CHARIZARD, DONPHAN], [SCIZOR, TYRANITAR, HEATRAN]);
    for (const difficulty of ['normal', 'hard', 'champion'] as const) {
      const legal = listLegalChoices(sc.request);
      const a = createOpponentAI(difficulty, { strict: true }).choose({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng: new sim.PRNG('9,9,9,9'), difficulty });
      const b = createOpponentAI(difficulty, { strict: true }).choose({ battle: sc.battle, side: sc.battle.p2, request: sc.request, prng: new sim.PRNG('9,9,9,9'), difficulty });
      expect(legal).toContain(a);
      expect(a).toBe(b);
    }
  });

  it('forced switches pick the best matchup', () => {
    // Scizor faints to Flamethrower; the AI must pick a replacement and should prefer Heatran (Flash Fire).
    const battle = newBattle('3,1,4,1');
    battle.setPlayer('p1', { name: 'Player', team: [CHARIZARD] });
    battle.setPlayer('p2', { name: 'AI', team: [SCIZOR, TYRANITAR, HEATRAN] });
    battle.sendUpdates();
    const scizor = battle.p2.active[0]!;
    scizor.sethp(1);
    expect(battle.choose('p1', 'move 1')).toBe(true);
    expect(battle.choose('p2', 'move 1')).toBe(true);
    battle.sendUpdates();
    const request = battle.p2.activeRequest;
    expect(request?.forceSwitch?.[0]).toBe(true);
    const agent = createOpponentAI('hard', { strict: true });
    const choice = agent.choose({ battle, side: battle.p2, request: request!, prng: new sim.PRNG('3,1,4,1'), difficulty: 'hard' });
    expect(listLegalChoices(request)).toContain(choice);
    const index = Number(choice.slice('switch '.length)) - 1;
    expect(['Heatran', 'Tyranitar']).toContain(request!.side.pokemon[index].details.split(',')[0]);
    expect(battle.choose('p2', choice)).toBe(true);
  });
});

describe('createOpponentAI – Revival Blessing', () => {
  const PAWMOT = set({ species: 'Pawmot', ability: 'Volt Absorb', item: 'Leftovers', nature: 'Jolly', moves: ['Revival Blessing', 'Splash'], evs: { ...ZERO_EVS, atk: 252, spe: 252 } });
  const KARP_L1 = set({ species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 1 });
  const GARCHOMP = set({ species: 'Garchomp', ability: 'Rough Skin', item: 'Leftovers', nature: 'Jolly', moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Stone Edge'], evs: { ...ZERO_EVS, atk: 252, spe: 252 } });
  const TOSS_BLISSEY = set({ species: 'Blissey', ability: 'Natural Cure', item: 'Leftovers', nature: 'Bold', gender: 'F', moves: ['Seismic Toss', 'Soft-Boiled'], evs: { ...ZERO_EVS, hp: 252, def: 252 } });

  /** Faints a bench Pokémon in place (as if it had been KOed earlier). */
  const faintBench = (battle: SimBattle, index: number) => {
    battle.p2.pokemon[index].faint();
    battle.faintMessages();
  };

  it('never uses it without a fainted teammate', () => {
    const sc = scenario([TOSS_BLISSEY], [PAWMOT, KARP_L1]);
    const blessing = `move ${moveIndex(sc, 'Revival Blessing')}`;
    expect(scoreOf(sc, 'hard', blessing)).toBeLessThanOrEqual(-50);
    expect(scoreOf(sc, 'champion', blessing)).toBeLessThanOrEqual(-50);
  });

  it('uses it when a teammate is down and then revives the most valuable fainted Pokémon with a legal choice', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([TOSS_BLISSEY], [PAWMOT, KARP_L1, GARCHOMP], '2,7,1,8', (battle) => {
        faintBench(battle, 1);
        faintBench(battle, 2);
      });
      const { battle } = sc;
      expect(battle.p2.pokemonLeft).toBe(1);
      const blessing = `move ${moveIndex(sc, 'Revival Blessing')}`;
      expect(choose(sc, difficulty)).toBe(blessing);
      expect(battle.choose('p2', blessing)).toBe(true);
      expect(battle.choose('p1', 'move 2')).toBe(true);
      battle.sendUpdates();

      const request = battle.p2.activeRequest!;
      expect(request.forceSwitch?.[0]).toBe(true);
      expect(isRevivingRequest(request)).toBe(true);
      const legal = listLegalChoices(request);
      expect(legal).toEqual(['switch 2', 'switch 3']);
      const agent = createOpponentAI(difficulty, { strict: true });
      const pick = agent.choose({ battle, side: battle.p2, request, prng: new sim.PRNG('2,7,1,8'), difficulty });
      expect(pick).toBe('switch 3'); // Garchomp over a level-1 Magikarp
      const ranked = scoreActions({ battle, side: battle.p2, request, prng: new sim.PRNG('2,7,1,8'), difficulty });
      expect(ranked.map((a) => a.choice)).toEqual(['switch 3', 'switch 2']);
      expect(ranked[0].detail).toContain('revive');
      expect(battle.choose('p2', pick)).toBe(true);
      battle.sendUpdates();
      const chomp = battle.p2.pokemon.find((p) => p.species.name === 'Garchomp')!;
      expect(chomp.fainted).toBe(false);
      expect(chomp.hp).toBe(Math.floor(chomp.maxhp / 2));
      expect(chomp.isActive).toBe(false);
      expect(battle.p2.active[0]?.species.name).toBe('Pawmot');
      expect(battle.inputLog.some((l) => l.endsWith(' pass'))).toBe(false);
    }
  });
});

describe('createOpponentAI – bench items and abilities', () => {
  const VOLCARONA = set({ species: 'Volcarona', ability: 'Flame Body', item: 'Heavy-Duty Boots', nature: 'Timid', moves: ['Fiery Dance', 'Bug Buzz', 'Quiver Dance', 'Giga Drain'], evs: { ...ZERO_EVS, spa: 252, spe: 252 } });
  const ROTOM_W = set({ species: 'Rotom-Wash', ability: 'Levitate', item: 'Leftovers', nature: 'Bold', moves: ['Hydro Pump', 'Volt Switch', 'Will-O-Wisp', 'Pain Split'], evs: { ...ZERO_EVS, hp: 252, def: 252 } });
  const CLEFABLE = set({ species: 'Clefable', ability: 'Magic Guard', item: 'Leftovers', nature: 'Bold', gender: 'F', moves: ['Moonblast', 'Soft-Boiled'], evs: { ...ZERO_EVS, hp: 252, def: 252 } });
  const TOXAPEX = set({ species: 'Toxapex', ability: 'Regenerator', item: 'Black Sludge', nature: 'Bold', moves: ['Scald', 'Recover'], evs: { ...ZERO_EVS, hp: 252, def: 252 } });
  const BALLOON_HEATRAN = { ...HEATRAN, item: 'Air Balloon' };
  const BOOTS_HEATRAN = { ...HEATRAN, item: 'Heavy-Duty Boots' };

  const withHazards = (battle: SimBattle, layers: { spikes?: number; toxicSpikes?: number; web?: boolean }) => {
    const src = battle.p1.active[0]!;
    battle.p2.addSideCondition('stealthrock', src);
    for (let i = 0; i < (layers.spikes ?? 0); i++) battle.p2.addSideCondition('spikes', src);
    for (let i = 0; i < (layers.toxicSpikes ?? 0); i++) battle.p2.addSideCondition('toxicspikes', src);
    if (layers.web) battle.p2.addSideCondition('stickyweb', src);
  };
  const envFor = (battle: SimBattle) => ({ battle, side: battle.p2, dmg: new DamageModel(battle), difficulty: 'hard' as const, prng: new sim.PRNG('1,2,3,4') });

  it('reads Heavy-Duty Boots, Air Balloon, Levitate, Magic Guard and typing of bench Pokémon for entry hazards', () => {
    const sc = scenario([CHARIZARD], [SCIZOR, BOOTS_HEATRAN, BALLOON_HEATRAN, ROTOM_W, CLEFABLE, TOXAPEX], '1,2,3,4', (battle) => withHazards(battle, { spikes: 2, toxicSpikes: 1, web: true }));
    const env = envFor(sc.battle);
    const [scizor, boots, balloon, rotom, clefable, toxapex] = sc.battle.p2.pokemon;
    // The sim itself hides items/abilities of inactive Pokémon; the AI must not.
    expect(boots.hasItem('heavydutyboots')).toBe(false);
    expect(rotom.hasAbility('levitate')).toBe(false);
    expect(isGroundedNow(rotom)).toBeNull();
    expect(isGroundedNow(balloon)).toBe(false);
    expect(isGroundedNow(scizor)).toBe(true);
    expect(entryHazards(env, boots)).toEqual({ pct: 0, absorbsToxicSpikes: false, poisoned: false, webbed: false });
    expect(entryHazards(env, balloon)).toEqual({ pct: 12.5, absorbsToxicSpikes: false, poisoned: false, webbed: false });
    expect(entryHazards(env, rotom)).toEqual({ pct: 12.5, absorbsToxicSpikes: false, poisoned: false, webbed: false });
    expect(entryHazards(env, clefable)).toEqual({ pct: 0, absorbsToxicSpikes: false, poisoned: true, webbed: true });
    expect(entryHazards(env, toxapex)).toMatchObject({ absorbsToxicSpikes: true, poisoned: false, webbed: true });
    expect(entryHazards(env, toxapex).pct).toBeCloseTo(12.5 + 100 / 6, 5);
    expect(entryHazards(env, scizor).pct).toBeCloseTo(12.5 + 100 / 6, 5); // Bug/Steel: neutral to Rock
    // Regenerator and Levitate also count in the matchup itself (a benched Rotom-W is immune to Earthquake).
    const donphanSc = scenario([DONPHAN], [SCIZOR, ROTOM_W, TOXAPEX]);
    const donphan = donphanSc.battle.p1.active[0]!;
    expect(isImmune(donphanSc.battle, donphanSc.battle.dex.moves.get('earthquake'), donphan, donphanSc.battle.p2.pokemon[1])).toBe(true);
    const dEnv = envFor(donphanSc.battle);
    const pex = matchupScore(dEnv, donphanSc.battle.p2.pokemon[2], donphan, { onEntry: true });
    expect(pex.detail).toContain('hazards 0%');
    const noRegen = scenario([DONPHAN], [SCIZOR, ROTOM_W, { ...TOXAPEX, ability: 'Limber' }]);
    const pexNoRegen = matchupScore(envFor(noRegen.battle), noRegen.battle.p2.pokemon[2], noRegen.battle.p1.active[0]!, { onEntry: true });
    expect(pex.total - pexNoRegen.total).toBeCloseTo(5, 5);
  });

  it('Heatran holding Boots / Air Balloon is a better entry than the same Heatran holding Leftovers with hazards up', () => {
    const totals: Record<string, number> = {};
    for (const heatran of [HEATRAN, BOOTS_HEATRAN, BALLOON_HEATRAN]) {
      const sc = scenario([CHARIZARD], [SCIZOR, heatran], '1,2,3,4', (battle) => withHazards(battle, { spikes: 2 }));
      const env = envFor(sc.battle);
      totals[heatran.item] = matchupScore(env, sc.battle.p2.pokemon[1], sc.battle.p1.active[0]!, { onEntry: true }).total;
      // Forced switch: Scizor faints, the only replacement is Heatran, and its score must reflect its item.
      sc.battle.p2.active[0]!.sethp(1);
      expect(sc.battle.choose('p1', 'move 1')).toBe(true);
      expect(sc.battle.choose('p2', 'move 1')).toBe(true);
      sc.battle.sendUpdates();
      const request = sc.battle.p2.activeRequest!;
      const ranked = scoreActions({ battle: sc.battle, side: sc.battle.p2, request, prng: new sim.PRNG('1,2,3,4'), difficulty: 'hard' });
      expect(ranked[0].choice).toBe('switch 2');
      expect(ranked[0].detail).toContain(heatran.item === 'Leftovers' ? 'hazards 29%' : heatran.item === 'Air Balloon' ? 'hazards 13%' : 'hazards 0%');
    }
    expect(totals['Heavy-Duty Boots']).toBeGreaterThan(totals['Air Balloon']);
    expect(totals['Air Balloon']).toBeGreaterThan(totals['Leftovers']);
    expect(totals['Heavy-Duty Boots'] - totals['Leftovers']).toBeGreaterThan(10);
  });

  it('forced switch into Stealth Rock + Spikes picks the Boots Charizard over a Levitate Rotom-W that gets KOed', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([VOLCARONA], [FERROTHORN, CHARIZARD, ROTOM_W, SCIZOR], '1,2,3,4', (battle) => {
        withHazards(battle, { spikes: 2 });
        battle.p2.active[0]!.sethp(1);
        const zard = battle.p2.pokemon[1];
        zard.sethp(Math.floor(zard.maxhp * 0.6));
      });
      const { battle } = sc;
      expect(battle.choose('p1', 'move 1')).toBe(true);
      expect(battle.choose('p2', 'move 1')).toBe(true);
      battle.sendUpdates();
      const request = battle.p2.activeRequest!;
      expect(request.forceSwitch?.[0]).toBe(true);
      const ranked = scoreActions({ battle, side: battle.p2, request, prng: new sim.PRNG('1,2,3,4'), difficulty });
      const zard = ranked.find((a) => a.choice === 'switch 2')!;
      expect(zard.detail).not.toContain('would faint');
      expect(zard.detail).toContain('hazards 0%');
      expect(ranked[0].choice).toBe('switch 2');
      const choice = createOpponentAI(difficulty, { strict: true }).choose({ battle, side: battle.p2, request, prng: new sim.PRNG('1,2,3,4'), difficulty });
      expect(choice).toBe('switch 2');
      expect(battle.choose('p2', choice)).toBe(true);
    }
  });
});

describe('createOpponentAI – moves typed by the user', () => {
  const ARCEUS_GHOST = set({ species: 'Arceus-Ghost', ability: 'Multitype', item: 'Spooky Plate', nature: 'Timid', moves: ['Judgment', 'Recover', 'Calm Mind', 'Focus Blast'], evs: { ...ZERO_EVS, spa: 252, spe: 252 } });
  const PELIPPER = set({ species: 'Pelipper', ability: 'Drizzle', item: 'Life Orb', nature: 'Modest', moves: ['Weather Ball', 'U-turn', 'Roost', 'Tailwind'], evs: { ...ZERO_EVS, spa: 252, spe: 252 } });
  const MAGNEZONE = set({ species: 'Magnezone', ability: 'Magnet Pull', item: 'Leftovers', nature: 'Modest', moves: ['Hidden Power Fire', 'Thunderbolt', 'Flash Cannon', 'Volt Switch'], evs: { ...ZERO_EVS, spa: 252, hp: 252 } });
  const SILVALLY_FIRE = set({ species: 'Silvally-Fire', ability: 'RKS System', item: 'Fire Memory', nature: 'Jolly', moves: ['Multi-Attack', 'Flame Charge', 'Parting Shot', 'Thunderbolt'], evs: { ...ZERO_EVS, atk: 252, spe: 252 } });
  const AEGISLASH = set({ species: 'Aegislash', ability: 'Stance Change', item: 'Leftovers', nature: 'Quiet', moves: ["King's Shield", 'Shadow Ball', 'Iron Head', 'Swords Dance'], evs: { ...ZERO_EVS, hp: 252, spa: 252 } });
  const HAPPY_SNORLAX = { ...SNORLAX, moves: ['Return', 'Frustration', 'Earthquake', 'Curse'] };

  const pct = (sc: Scenario, moveName: string) => {
    const me = sc.battle.p2.active[0]!;
    const foe = sc.battle.p1.active[0]!;
    const id = sc.battle.dex.moves.get(moveName).id;
    return new DamageModel(sc.battle).estimate(me, foe, id);
  };

  it('Judgment takes the plate type: Arceus-Ghost vs Gengar is a KO, not an immunity', () => {
    for (const difficulty of ['hard', 'champion'] as const) {
      const sc = scenario([GENGAR], [ARCEUS_GHOST]);
      const me = sc.battle.p2.active[0]!;
      expect(resolveMove(sc.battle, sc.battle.dex.moves.get('judgment'), me)).toEqual({ type: 'Ghost', basePower: 100 });
      expect(isImmune(sc.battle, sc.battle.dex.moves.get('judgment'), me, sc.battle.p1.active[0]!)).toBe(false);
      const est = pct(sc, 'Judgment');
      expect(est.immune).toBe(false);
      expect(est.koChance).toBe(1);
      const judgment = `move ${moveIndex(sc, 'Judgment')}`;
      expect(choose(sc, difficulty)).toBe(judgment);
      expect(scoreOf(sc, difficulty, judgment)).toBeGreaterThan(100);
      expect(scoreOf(sc, difficulty, `move ${moveIndex(sc, 'Focus Blast')}`)).toBeLessThanOrEqual(-50);
    }
    // Without a plate Judgment is Normal and Gengar is immune.
    const plain = scenario([GENGAR], [{ ...ARCEUS_GHOST, species: 'Arceus', item: 'Leftovers' }]);
    expect(pct(plain, 'Judgment').immune).toBe(true);
  });

  it('Weather Ball follows the weather: Water and doubled in rain, Normal (Ghost-immune) without weather', () => {
    const rain = scenario([GENGAR], [PELIPPER]);
    expect(rain.battle.field.weather).toBe('raindance');
    const me = rain.battle.p2.active[0]!;
    expect(resolveMove(rain.battle, rain.battle.dex.moves.get('weatherball'), me)).toEqual({ type: 'Water', basePower: 100 });
    const est = pct(rain, 'Weather Ball');
    expect(est.immune).toBe(false);
    expect(est.koChance).toBe(1);
    const weatherBall = `move ${moveIndex(rain, 'Weather Ball')}`;
    expect(choose(rain, 'hard')).toBe(weatherBall);
    expect(choose(rain, 'champion')).toBe(weatherBall);
    const dry = scenario([GENGAR], [{ ...PELIPPER, ability: 'Keen Eye' }]);
    expect(resolveMove(dry.battle, dry.battle.dex.moves.get('weatherball'), dry.battle.p2.active[0]!)).toEqual({ type: 'Normal', basePower: 50 });
    expect(pct(dry, 'Weather Ball').immune).toBe(true);
    expect(scoreOf(dry, 'hard', `move ${moveIndex(dry, 'Weather Ball')}`)).toBeLessThanOrEqual(-50);
  });

  it('Hidden Power uses the set\'s type (Fire: 4× on Ferrothorn, hits Gengar)', () => {
    const sc = scenario([FERROTHORN], [MAGNEZONE]);
    const me = sc.battle.p2.active[0]!;
    expect(me.hpType).toBe('Fire');
    expect(resolveMove(sc.battle, sc.battle.dex.moves.get('hiddenpower'), me)).toEqual({ type: 'Fire', basePower: 60 });
    const est = pct(sc, 'Hidden Power');
    expect(est.maxPct).toBeGreaterThan(60);
    expect(choose(sc, 'hard')).toBe(`move ${moveIndex(sc, 'Hidden Power')}`);
    const ghost = scenario([GENGAR], [MAGNEZONE]);
    expect(pct(ghost, 'Hidden Power').immune).toBe(false);
    expect(pct(ghost, 'Hidden Power').maxPct).toBeGreaterThan(20);
  });

  it('Multi-Attack takes the memory type and Frustration is 1 BP at max happiness', () => {
    const sc = scenario([AEGISLASH], [SILVALLY_FIRE]);
    expect(resolveMove(sc.battle, sc.battle.dex.moves.get('multiattack'), sc.battle.p2.active[0]!)).toEqual({ type: 'Fire', basePower: 120 });
    const est = pct(sc, 'Multi-Attack');
    expect(est.immune).toBe(false);
    expect(est.maxPct).toBeGreaterThan(60);
    expect(choose(sc, 'hard')).toBe(`move ${moveIndex(sc, 'Multi-Attack')}`);

    const lax = scenario([BLISSEY], [HAPPY_SNORLAX]);
    const me = lax.battle.p2.active[0]!;
    expect(resolveMove(lax.battle, lax.battle.dex.moves.get('return'), me)).toEqual({ type: 'Normal', basePower: 102 });
    expect(resolveMove(lax.battle, lax.battle.dex.moves.get('frustration'), me)).toEqual({ type: 'Normal', basePower: 1 });
    expect(pct(lax, 'Return').maxPct).toBeGreaterThan(40);
    expect(pct(lax, 'Frustration').maxPct).toBeLessThan(3);
    expect(scoreOf(lax, 'hard', `move ${moveIndex(lax, 'Frustration')}`)).toBeLessThan(scoreOf(lax, 'hard', `move ${moveIndex(lax, 'Earthquake')}`));
    expect(choose(lax, 'hard')).not.toBe(`move ${moveIndex(lax, 'Frustration')}`);
  });

  it('Ultra Burst is used like a Mega Evolution', () => {
    const necrozma = set({ species: 'Necrozma-Dusk-Mane', ability: 'Prism Armor', item: 'Ultranecrozium Z', nature: 'Adamant', gender: 'N', moves: ['Sunsteel Strike', 'Earthquake', 'Dragon Dance', 'Photon Geyser'], evs: { ...ZERO_EVS, atk: 252, spe: 252 } });
    const sc = scenario([BLISSEY], [necrozma]);
    expect(asMoveRequest(sc).active[0].canUltraBurst).toBe(true);
    expect(listLegalChoices(sc.request)).toContain('move 1 ultra');
    for (const difficulty of ['hard', 'champion'] as const) {
      const choice = choose(sc, difficulty);
      expect(choice).toContain(' ultra');
      expect(sc.battle.choose('p2', choice)).toBe(true);
      sc.battle.p2.clearChoice();
    }
    const ranked = scores(sc, 'champion');
    expect(ranked[0].choice).toContain(' ultra');
    // Photon Geyser keeps its STAB and gains Necrozma-Ultra's attack stats; Sunsteel Strike loses the Steel STAB.
    const geyser = moveIndex(sc, 'Photon Geyser');
    const base = ranked.find((a) => a.choice === `move ${geyser}`)!;
    const ultra = ranked.find((a) => a.choice === `move ${geyser} ultra`)!;
    expect(ultra.score).toBeGreaterThan(base.score);
    expect(ultra.detail).toContain('ultra:');
    expect(choose(sc, 'normal')).not.toContain(' ultra');
  });
});

describe('createOpponentAI – performance', () => {
  it('averages under 50 ms per decision over 100 decisions', () => {
    const agent = createOpponentAI('champion', { strict: true });
    let decisions = 0;
    let totalMs = 0;
    for (let i = 0; decisions < 100 && i < 20; i++) {
      const seedA: Seed = `${i + 31},${i + 32},${i + 33},${i + 34}`;
      const seedB: Seed = `${i + 41},${i + 42},${i + 43},${i + 44}`;
      const outcome = playBattle(`${i + 51},${i + 52},${i + 53},${i + 54}`, randomTeam(seedA), randomTeam(seedB), agent, 'champion');
      decisions += outcome.aiDecisions;
      totalMs += outcome.totalMs;
    }
    const avg = totalMs / Math.max(1, decisions);
    console.log(`[ai] champion: ${decisions} decisions, ${avg.toFixed(2)} ms average`);
    expect(decisions).toBeGreaterThanOrEqual(100);
    expect(avg).toBeLessThan(50);
  });
});
