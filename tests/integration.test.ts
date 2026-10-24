/**
 * Cross-module integration: random team generation → trainer data → battle session → opponent AI.
 * Every scenario is seeded so the run is deterministic.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { PRNG as SimPRNG } from '@pkmn/sim';
import { createBattleSession, restoreBattleSession } from '@/lib/battle';
import type { BattleConfig, BattleSession, PlayerRequest, PokemonSet, SubmitResult, TurnResult } from '@/lib/battle';
import { DEFAULT_TEAM_SETTINGS, generateTeam, toSets } from '@/lib/teams';
import { trainerToSets } from '@/lib/game/trainerTeam';
import { TRAINERS, getTrainer } from '@/data/trainers';
import { createOpponentAI } from '@/lib/ai';
import { seedFromString } from '@/lib/util/seed';
import type { Trainer } from '@/data/trainers/types';

type Sim = typeof import('@pkmn/sim');
let sim: Sim;

beforeAll(async () => {
  sim = await import('@pkmn/sim');
});

const MAX_SUBMITS = 300;

function cynthia(): Trainer {
  const t = getTrainer('cynthia');
  if (!t) throw new Error('cynthia trainer missing');
  return t;
}

function configFor(seedName: string, player: PokemonSet[], trainer: Trainer, level: 50 | 100 = 100): BattleConfig {
  return {
    seed: seedFromString(seedName),
    player: { name: 'Challenger', team: player },
    opponent: {
      name: trainer.name,
      team: trainerToSets(trainer, level),
      difficulty: trainer.ai,
      trainerId: trainer.id,
      avatar: trainer.avatar,
    },
  };
}

/** Choices the player may make for a PlayerRequest (Showdown's 1-based index semantics). */
function legalPlayerChoices(req: PlayerRequest | null): string[] {
  if (!req || req.kind === 'wait') return [];
  const switches = req.team
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.active && !p.fainted)
    .map(({ i }) => `switch ${i + 1}`);
  if (req.kind === 'switch') return switches.length ? switches : ['pass'];
  const moves = req.active.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.disabled)
    .map(({ i }) => `move ${i + 1}`);
  const choices = moves.length ? moves : ['move 1'];
  if (!req.active.trapped) choices.push(...switches);
  return choices;
}

/** Highest base-power usable move, otherwise the first available switch. */
function heuristicChoice(req: PlayerRequest | null): string | null {
  if (!req || req.kind === 'wait') return null;
  const switches = legalPlayerChoices(req).filter((c) => c.startsWith('switch') || c === 'pass');
  if (req.kind === 'switch') return switches[0] ?? null;
  let best: { index: number; power: number } | null = null;
  req.active.moves.forEach((m, i) => {
    if (m.disabled || m.pp <= 0) return;
    if (!best || m.basePower > best.power) best = { index: i, power: m.basePower };
  });
  if (best) return `move ${(best as { index: number }).index + 1}`;
  if (switches.length && !req.active.trapped) return switches[0];
  return 'move 1';
}

/** Submits `choice`; when the engine refuses it (e.g. a trap), tries the remaining legal choices. */
function submitWithFallback(session: BattleSession, choice: string): SubmitResult {
  let result = session.submit(choice);
  if (result.ok) return result;
  for (const alt of legalPlayerChoices(session.request())) {
    if (alt === choice) continue;
    result = session.submit(alt);
    if (result.ok) return result;
  }
  return result;
}

function submitRandom(session: BattleSession, prng: SimPRNG): SubmitResult {
  const order = legalPlayerChoices(session.request());
  expect(order.length).toBeGreaterThan(0);
  prng.shuffle(order);
  return submitWithFallback(session, order[0]);
}

function expectRequestConsistent(result: TurnResult) {
  if (result.ended) {
    expect(result.snapshot.ended).toBe(true);
    return;
  }
  expect(result.request).not.toBeNull();
  expect(['move', 'switch']).toContain(result.request!.kind);
  if (result.request!.kind === 'move') {
    const active = result.snapshot.sides.p1.active;
    expect(active).not.toBeNull();
    expect(active!.hp).toBeGreaterThan(0);
  }
}

async function generated(seed: string): Promise<PokemonSet[]> {
  const team = await generateTeam(DEFAULT_TEAM_SETTINGS, seed);
  const sets = toSets(team);
  expect(sets).toHaveLength(6);
  return sets;
}

describe('integration: generated team vs Cynthia with the champion AI', () => {
  it('plays a full battle with a simple heuristic until it ends', async () => {
    const player = await generated('seed');
    const config = configFor('integration-heuristic', player, cynthia());
    const session = await createBattleSession(config, { ai: createOpponentAI('champion', { strict: true }) });

    const first = session.start();
    expect(first.snapshot.turn).toBe(1);
    expect(first.snapshot.sides.p1.pokemon).toHaveLength(6);
    expect(first.snapshot.sides.p2.pokemon).toHaveLength(6);
    expect(first.snapshot.sides.p2.active?.species).toBe('Spiritomb');
    expect(first.request?.kind).toBe('move');

    let submits = 0;
    let last: TurnResult = first;
    while (!session.ended) {
      expect(submits).toBeLessThan(MAX_SUBMITS);
      const choice = heuristicChoice(session.request());
      expect(choice).not.toBeNull();
      const result = submitWithFallback(session, choice!);
      if (!result.ok) throw new Error(`refused ${choice}: ${result.error}`);
      submits++;
      last = result;
      expectRequestConsistent(result);
    }
    expect(last.ended).toBe(true);
    expect(last.winner === 'p1' || last.winner === 'p2' || last.winner === 'tie').toBe(true);
    expect(last.events.some((e) => e.kind === 'win')).toBe(true);
    expect(session.snapshot().ended).toBe(true);
    expect(session.turn).toBeGreaterThan(1);
  });
});

describe('integration: random legal player choices across seeds', () => {
  const difficulties = ['normal', 'hard', 'champion'] as const;
  for (let i = 0; i < 10; i++) {
    const difficulty = difficulties[i % difficulties.length];
    it(`seed ${i} (${difficulty} AI) ends within ${MAX_SUBMITS} submits`, async () => {
      const trainer = TRAINERS[i % TRAINERS.length];
      const player = await generated(`integration-${i}`);
      const config = configFor(`integration-battle-${i}`, player, trainer);
      const session = await createBattleSession(config, { ai: createOpponentAI(difficulty, { strict: true }) });
      const prng = new sim.PRNG(seedFromString(`player-choices-${i}`) as `${number},${string}`);

      const first = session.start();
      expectRequestConsistent(first);
      let submits = 0;
      let last: TurnResult = first;
      while (!session.ended) {
        expect(submits).toBeLessThan(MAX_SUBMITS);
        const result = submitRandom(session, prng);
        if (!result.ok) throw new Error(`every legal choice refused: ${result.error}`);
        submits++;
        last = result;
        expectRequestConsistent(result);
        for (const e of result.events) {
          expect(e.text).not.toContain('**');
          expect(e.text).not.toMatch(/lost \d+% of its health/);
        }
      }
      expect(last.winner).not.toBeNull();
      expect(session.serialize().inputLog.length).toBeGreaterThan(2);
    });
  }
});

describe('integration: serialize / restore mid-battle', () => {
  it('restores to an identical state and stays in sync afterwards', async () => {
    const player = await generated('integration-restore');
    const config = configFor('integration-restore-battle', player, cynthia());
    const ai = () => createOpponentAI('hard', { strict: true });
    const session = await createBattleSession(config, { ai: ai() });
    session.start();
    const prng = new sim.PRNG(seedFromString('restore-choices') as `${number},${string}`);
    for (let t = 0; t < 8 && !session.ended; t++) {
      const r = submitRandom(session, prng);
      expect(r.ok).toBe(true);
    }
    expect(session.ended).toBe(false);

    const saved = session.serialize();
    expect(saved.version).toBe(1);
    const restored = await restoreBattleSession(JSON.parse(JSON.stringify(saved)), { ai: ai() });
    expect(restored.turn).toBe(session.turn);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.request()).toEqual(session.request());
    expect(restored.serialize()).toEqual(saved);

    // Mirror the same choices on both sessions: results must stay identical.
    for (let t = 0; t < 6 && !session.ended; t++) {
      const order = legalPlayerChoices(session.request());
      prng.shuffle(order);
      let a: SubmitResult = { ok: false, error: '', request: null };
      let b: SubmitResult = { ok: false, error: '', request: null };
      for (const choice of order) {
        a = session.submit(choice);
        b = restored.submit(choice);
        expect(a.ok).toBe(b.ok);
        if (a.ok) break;
      }
      expect(a.ok).toBe(true);
      expect(b).toEqual(a);
      expect(restored.snapshot()).toEqual(session.snapshot());
    }
  });
});

describe('integration: Revival Blessing through the session with the champion AI', () => {
  const BASE = { item: '', nature: 'Hardy', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100 as const };
  const KARP_L1: PokemonSet = { ...BASE, name: 'Magikarp', species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], gender: 'M', level: 1 };
  const PAWMOT: PokemonSet = { ...BASE, name: 'Pawmot', species: 'Pawmot', ability: 'Volt Absorb', item: 'Leftovers', moves: ['Revival Blessing', 'Splash'], gender: 'M' };
  const RABSCA: PokemonSet = { ...BASE, name: 'Rabsca', species: 'Rabsca', ability: 'Synchronize', item: 'Leftovers', moves: ['Revival Blessing', 'Bug Buzz'], gender: 'F' };
  const CHOMP: PokemonSet = { ...BASE, name: 'Garchomp', species: 'Garchomp', ability: 'Rough Skin', moves: ['Earthquake', 'Splash'], gender: 'M', evs: { ...BASE.evs, atk: 252 } };
  const WEAK: PokemonSet = { ...BASE, name: 'Blissey', species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'], gender: 'F' };
  /** KOs a level-1 Magikarp but only chips a level-100 Pokémon, so the reviver survives the turn. */
  const TOSSER: PokemonSet = { ...WEAK, name: 'Chansey', species: 'Chansey', moves: ['Seismic Toss'] };

  function sessionConfig(seedName: string, player: PokemonSet[], opponent: PokemonSet[]): BattleConfig {
    return { seed: seedFromString(seedName), player: { name: 'Challenger', team: player }, opponent: { name: 'Rival', team: opponent, difficulty: 'champion' } };
  }

  for (const reviver of [PAWMOT, RABSCA]) {
    it(`${reviver.name} on the player's side: the reviving request is answerable and resumable`, async () => {
      const session = await createBattleSession(sessionConfig(`revival-player-${reviver.name}`, [KARP_L1, reviver, WEAK], [TOSSER]), { ai: createOpponentAI('champion', { strict: true }) });
      session.start();
      const faint = session.submit('move 1');
      expect(faint.ok && faint.request?.kind).toBe('switch');
      const inPlay = session.submit('switch 2');
      expect(inPlay.ok && inPlay.snapshot.sides.p1.active?.name).toBe(reviver.name);
      const blessing = session.submit('move 1');
      expect(blessing.ok).toBe(true);
      if (!blessing.ok) return;
      expect(blessing.request).toMatchObject({ kind: 'switch', reviving: true });
      const req = blessing.request;
      if (!req || req.kind !== 'switch') return;
      const faintedSlots = req.team.map((p, i) => ({ p, i })).filter(({ p }) => p.fainted && !p.active).map(({ i }) => `switch ${i + 1}`);
      expect(faintedSlots).toEqual(['switch 2']);
      expect(session.submit('switch 3').ok).toBe(false);
      // Refreshing in this state must resume to the same reviving request, not a dead end.
      const resumed = await restoreBattleSession(JSON.parse(JSON.stringify(session.serialize())), { ai: createOpponentAI('champion', { strict: true }) });
      expect(resumed.request()).toMatchObject({ kind: 'switch', reviving: true });
      const revived = session.submit('switch 2');
      expect(revived.ok).toBe(true);
      if (!revived.ok) return;
      expect(revived.snapshot.sides.p1.pokemon[1]).toMatchObject({ name: 'Magikarp', fainted: false, active: false });
      expect(revived.snapshot.sides.p1.pokemon[1].hp).toBeGreaterThan(0);
      expect(revived.request?.kind).toBe('move');
      expect(session.serialize().inputLog.filter((l) => l.endsWith(' pass'))).toEqual([]);
      expectRequestConsistent(revived);
    });
  }

  it("AI's Pawmot revives a teammate (no healthy bench, no wasted 'pass')", async () => {
    const session = await createBattleSession(sessionConfig('revival-ai', [CHOMP], [KARP_L1, PAWMOT]), { ai: createOpponentAI('champion', { strict: true }) });
    session.start();
    const first = session.submit('move 1'); // Earthquake KOs the level-1 Magikarp, the AI sends Pawmot
    expect(first.ok && first.snapshot.sides.p2.active?.name).toBe('Pawmot');
    const second = session.submit('move 2'); // Splash: the AI uses Revival Blessing and picks Magikarp
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.request?.kind).toBe('move');
    const karp = second.snapshot.sides.p2.pokemon.find((p) => p.name === 'Magikarp')!;
    expect(karp.fainted).toBe(false);
    expect(karp.hp).toBe(Math.floor(karp.maxhp / 2));
    const log = session.serialize().inputLog;
    expect(log.some((l) => l === '>p2 move revivalblessing')).toBe(true);
    expect(log.filter((l) => l.endsWith(' pass'))).toEqual([]);
    expect(second.events.some((e) => e.kind === 'heal' && e.side === 'p2')).toBe(true);
    const restored = await restoreBattleSession(JSON.parse(JSON.stringify(session.serialize())), { ai: createOpponentAI('champion', { strict: true }) });
    expect(restored.snapshot()).toEqual(session.snapshot());
  });
});

describe('integration: every trainer team vs a generated team', () => {
  for (const trainer of TRAINERS) {
    it(`${trainer.name} (${trainer.id}) runs 3 turns without errors`, async () => {
      const player = await generated(`vs-${trainer.id}`);
      const config = configFor(`integration-${trainer.id}`, player, trainer, 100);
      expect(config.opponent.team).toHaveLength(6);
      const session = await createBattleSession(config, { ai: createOpponentAI(trainer.ai, { strict: true }) });
      const first = session.start();
      expect(first.snapshot.sides.p2.name).toBe(trainer.name);
      expect(first.snapshot.sides.p2.pokemon.map((p) => p.hp > 0).every(Boolean)).toBe(true);
      expect(first.snapshot.sides.p2.active?.species.split('-')[0]).toBe(trainer.team[0].species.split('-')[0]);
      const prng = new sim.PRNG(seedFromString(`choices-${trainer.id}`) as `${number},${string}`);
      let turns = 0;
      while (turns < 3 && !session.ended) {
        const r = submitRandom(session, prng);
        if (!r.ok) throw new Error(`${trainer.id}: refused: ${r.error}`);
        expectRequestConsistent(r);
        turns++;
      }
      expect(turns).toBe(3);
    });
  }
});
