import { describe, expect, it, beforeAll } from 'vitest';
import type { PokemonSet, PRNG as SimPRNG } from '@pkmn/sim';
import { createBattleSession, restoreBattleSession, describeChoice, SESSION_VERSION } from './session';
import { buildSnapshot } from './snapshot';
import type { BattleConfig, BattleEvent, BattleSession, OpponentAgent, PlayerRequest, PokemonView, SubmitResult, TurnResult } from './types';

type Sim = typeof import('@pkmn/sim');
type Randoms = typeof import('@pkmn/randoms');

let sim: Sim;
let randoms: Randoms;

beforeAll(async () => {
  sim = await import('@pkmn/sim');
  randoms = await import('@pkmn/randoms');
});

function team(seed: string): PokemonSet[] {
  const generator = randoms.TeamGenerators.getTeamGenerator('gen9randombattle', new sim.PRNG(seed as `${number},${string}`));
  return generator.getTeam().map((set) => ({ ...set, level: 100 }));
}

function config(seed: string, p1: PokemonSet[], p2: PokemonSet[], names = { p1: 'Red', p2: 'Cynthia' }): BattleConfig {
  return {
    seed,
    player: { name: names.p1, team: p1 },
    opponent: { name: names.p2, team: p2, difficulty: 'normal' },
  };
}

/** Choices the player may make according to its PlayerRequest (mirrors Showdown's index semantics). */
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

/** Submits a uniformly random legal choice; retries other choices if the engine refuses one. */
function submitRandom(session: BattleSession, prng: SimPRNG): { choice: string; result: SubmitResult } {
  const choices = legalPlayerChoices(session.request());
  expect(choices.length).toBeGreaterThan(0);
  const order = [...choices];
  prng.shuffle(order);
  let last: SubmitResult = { ok: false, error: 'no choices', request: null };
  for (const choice of order) {
    last = session.submit(choice);
    if (last.ok) return { choice, result: last };
  }
  throw new Error(`every legal choice was refused: ${JSON.stringify(order)} → ${JSON.stringify(last)}`);
}

const BASE: Omit<PokemonSet, 'name' | 'species' | 'moves' | 'ability' | 'gender'> = {
  item: '',
  nature: 'Hardy',
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  level: 100,
};
const MAGIKARP: PokemonSet = { ...BASE, name: 'Magikarp', species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], gender: 'M', level: 1 };
const PIKACHU: PokemonSet = { ...BASE, name: 'Pikachu', species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt', 'Quick Attack'], gender: 'M', level: 50 };
const GARCHOMP: PokemonSet = {
  ...BASE, name: 'Garchomp', species: 'Garchomp', item: 'Leftovers', ability: 'Rough Skin', moves: ['Earthquake', 'Dragon Claw'],
  nature: 'Jolly', gender: 'M', evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
};
const ELECTRODE: PokemonSet = { ...BASE, name: 'Electrode', species: 'Electrode', ability: 'Static', moves: ['Explosion'], gender: 'N', evs: { ...BASE.evs, atk: 252 } };
const KARP_L1: PokemonSet = { ...MAGIKARP, level: 1 };
const GOLDEEN: PokemonSet = { ...BASE, name: 'Goldeen', species: 'Goldeen', ability: 'Swift Swim', moves: ['Splash'], gender: 'M' };
const PAWMOT: PokemonSet = { ...BASE, name: 'Pawmot', species: 'Pawmot', ability: 'Volt Absorb', moves: ['Revival Blessing', 'Splash'], gender: 'M' };
const CHOMP_EQ: PokemonSet = { ...GARCHOMP, item: '', moves: ['Earthquake', 'Splash'], evs: { ...BASE.evs, atk: 252 } };

/** Opponent that plays a fixed script of choices, then falls back to "default". */
function scripted(...queue: string[]): OpponentAgent {
  const q = [...queue];
  return { choose: () => q.shift() ?? 'default' };
}

function submitOk(session: BattleSession, choice: string): TurnResult {
  const r = session.submit(choice);
  if (!r.ok) throw new Error(`refused ${choice}: ${r.error}`);
  return r;
}

async function expectRestoreEqual(session: BattleSession) {
  const restored = await restoreBattleSession(JSON.parse(JSON.stringify(session.serialize())));
  expect(restored.snapshot()).toEqual(session.snapshot());
  expect(restored.request()).toEqual(session.request());
}

function expectPokemonViewSane(p: PokemonView) {
  expect(p.moves.length).toBeGreaterThanOrEqual(1);
  expect(p.moves.length).toBeLessThanOrEqual(4);
  for (const m of p.moves) {
    expect(m.pp).toBeLessThanOrEqual(m.maxpp);
    expect(m.pp).toBeGreaterThanOrEqual(0);
  }
  expect(p.maxhp).toBeGreaterThan(0);
  expect(p.hp).toBeLessThanOrEqual(p.maxhp);
}

function expectResultSane(result: TurnResult) {
  for (const e of result.events) {
    expect(e.text).not.toContain('**');
    expect(e.text).not.toMatch(/lost .*% of its health/);
  }
  const { p1, p2 } = result.snapshot.sides;
  expect(p1.pokemon).toHaveLength(6);
  expect(p2.pokemon).toHaveLength(6);
  for (const p of [...p1.pokemon, ...p2.pokemon]) expectPokemonViewSane(p);
  if (result.ended) {
    expect(result.request).toBeNull();
    expect(result.winner).not.toBeNull();
    return;
  }
  expect(result.request).not.toBeNull();
  expect(['move', 'switch']).toContain(result.request!.kind);
  if (result.request!.kind === 'move') {
    const active = result.request!.team.find((p) => p.active);
    expect(active).toBeDefined();
    expect(active!.hp).toBeGreaterThan(0);
    expect(p1.active?.ident).toBe(active!.ident);
  }
}

describe('battle session', () => {
  it('plays 20 seeded random battles to completion', async () => {
    for (let i = 0; i < 20; i++) {
      const seed = `${i + 1},${i * 7 + 3},${i * 13 + 5},${i * 3 + 11}`;
      const session = await createBattleSession(config(seed, team(`${i + 1},1,1,1`), team(`${i + 1},2,2,2`)));
      const prng = new sim.PRNG(`${i + 9},${i + 8},${i + 7},${i + 6}`);
      const first = session.start();
      expect(first.events.some((e) => e.kind === 'switch' && e.side === 'p1')).toBe(true);
      expect(first.events.some((e) => e.kind === 'switch' && e.side === 'p2')).toBe(true);
      expect(first.events.some((e) => e.kind === 'turn' && e.turn === 1)).toBe(true);
      expectResultSane(first);

      let submits = 0;
      while (!session.ended) {
        expect(submits).toBeLessThan(500);
        const { result } = submitRandom(session, prng);
        submits++;
        expect(result.ok).toBe(true);
        if (result.ok) expectResultSane(result);
      }
      const final = session.snapshot();
      expect(final.ended).toBe(true);
      expect(['p1', 'p2', 'tie']).toContain(final.winner);
      expect(session.request()).toBeNull();
    }
  });

  it('request team order matches the sim side order (switch N ⇔ slot N-1)', () => {
    const battle = new sim.Battle({ formatid: 'gen9nationaldex@@@!Team Preview' as never, seed: '5,6,7,8' });
    battle.setPlayer('p1', { name: 'Red', team: team('3,3,3,3') });
    battle.setPlayer('p2', { name: 'Blue', team: team('4,4,4,4') });
    const request = battle.p1.activeRequest!;
    const requestIdents = request.side.pokemon.map((p) => p.ident);
    expect(requestIdents).toEqual(battle.p1.pokemon.map((p) => p.fullname));
    expect(buildSnapshot(battle).sides.p1.pokemon.map((p) => p.ident)).toEqual(requestIdents);
    expect(request.side.pokemon[0].active).toBe(true);
  });

  it('rejects illegal choices without advancing, then accepts a legal one', async () => {
    const session = await createBattleSession(config('11,22,33,44', team('7,7,7,7'), team('8,8,8,8')));
    session.start();
    const turn = session.turn;
    const before = session.snapshot();
    for (const bad of ['switch 1', 'move 9', 'switch 7', 'garbage', 'move 1 mega', '']) {
      const result = session.submit(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
      expect(session.turn).toBe(turn);
    }
    expect(session.snapshot()).toEqual(before);
    const good = session.submit('move 1');
    expect(good.ok).toBe(true);
    expect(session.turn).toBe(turn + 1);
  });

  it('handles a forced switch after the lead faints', async () => {
    const session = await createBattleSession(config('1,2,3,4', [MAGIKARP, PIKACHU], [GARCHOMP]));
    session.start();
    const result = session.submit('move 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request?.kind).toBe('switch');
    expect(result.events.some((e) => e.kind === 'faint' && e.side === 'p1' && e.ident === 'p1: Magikarp')).toBe(true);
    const faint = result.events.find((e) => e.kind === 'faint');
    expect(faint?.text).toContain('Magikarp fainted');
    expect(result.snapshot.sides.p1.pokemon[0].fainted).toBe(true);
    expect(session.submit('move 1').ok).toBe(false);
    const next = session.submit('switch 2');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.request?.kind).toBe('move');
    expect(next.snapshot.sides.p1.active?.ident).toBe('p1: Pikachu');
    expect(next.events.some((e) => e.kind === 'switch' && e.ident === 'p1: Pikachu')).toBe(true);
    expect(next.snapshot.turn).toBe(2);
  });

  it('handles both sides fainting at once (Explosion)', async () => {
    const session = await createBattleSession(config('1,2,3,4', [ELECTRODE, PIKACHU], [MAGIKARP, GARCHOMP]));
    session.start();
    const result = session.submit('move 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request?.kind).toBe('switch');
    expect(result.events.filter((e) => e.kind === 'faint').map((e) => e.side).sort()).toEqual(['p1', 'p2']);
    expect(result.snapshot.sides.p1.active).toBeNull();
    const next = session.submit('switch 2');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.request?.kind).toBe('move');
    expect(next.snapshot.sides.p1.active?.ident).toBe('p1: Pikachu');
    expect(next.snapshot.sides.p2.active?.ident).toBe('p2: Garchomp');
    expect(next.snapshot.sides.p2.active?.hp).toBeGreaterThan(0);
    expect(next.events.filter((e) => e.kind === 'switch').map((e) => e.side).sort()).toEqual(['p1', 'p2']);
  });

  it('lets the opponent replace its fainted Pokémon while the player waits', async () => {
    const session = await createBattleSession(config('1,2,3,4', [GARCHOMP, PIKACHU], [MAGIKARP, { ...MAGIKARP, name: 'Karp', gender: 'F' }]));
    session.start();
    const result = session.submit('move 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request?.kind).toBe('move');
    expect(result.snapshot.turn).toBe(2);
    expect(result.events.some((e) => e.kind === 'faint' && e.side === 'p2')).toBe(true);
    expect(result.events.some((e) => e.kind === 'switch' && e.side === 'p2' && e.ident === 'p2: Karp')).toBe(true);
    expect(result.snapshot.sides.p2.active?.ident).toBe('p2: Karp');
  });

  it('serializes and restores to an identical state', async () => {
    const cfg = config('21,22,23,24', team('9,9,9,9'), team('10,10,10,10'));
    const original = await createBattleSession(cfg);
    original.start();
    const prng = new sim.PRNG('31,32,33,34');
    for (let i = 0; i < 10; i++) {
      expect(original.ended).toBe(false);
      submitRandom(original, prng);
    }
    expect(original.turn).toBeGreaterThan(1);
    const saved = original.serialize();
    expect(saved.version).toBe(SESSION_VERSION);
    expect(saved.config.seed).toBe('21,22,23,24');
    expect(saved.inputLog.some((l) => l.startsWith('>p1 '))).toBe(true);

    const restored = await restoreBattleSession(JSON.parse(JSON.stringify(saved)));
    expect(restored.turn).toBe(original.turn);
    expect(restored.snapshot()).toEqual(original.snapshot());
    expect(restored.request()).toEqual(original.request());
    expect(restored.start().events).toEqual([]);

    for (let i = 0; i < 5 && !original.ended; i++) {
      const { choice, result } = submitRandom(original, prng);
      const mirrored = restored.submit(choice);
      expect(mirrored.ok).toBe(true);
      expect(result.ok).toBe(true);
      if (mirrored.ok && result.ok) {
        expect(mirrored.snapshot).toEqual(result.snapshot);
        expect(mirrored.request).toEqual(result.request);
        expect(mirrored.events).toEqual(result.events);
      }
      expect(restored.snapshot()).toEqual(original.snapshot());
      expect(restored.serialize()).toEqual(original.serialize());
    }
  });

  it('rejects a diverging or unsupported save', async () => {
    const cfg = config('41,42,43,44', team('12,12,12,12'), team('13,13,13,13'));
    const session = await createBattleSession(cfg);
    session.start();
    expect(session.submit('move 1').ok).toBe(true);
    const saved = session.serialize();
    const corrupt = { ...saved, inputLog: [...saved.inputLog, '>p1 switch 1'] };
    await expect(restoreBattleSession(corrupt)).rejects.toThrow('replay-diverged');
    await expect(restoreBattleSession({ ...saved, version: 2 as never })).rejects.toThrow();
    await expect(restoreBattleSession({ ...saved, config: { ...saved.config, seed: undefined } })).rejects.toThrow('replay-diverged');
  });

  it('forfeit ends the battle with the opponent winning', async () => {
    const session = await createBattleSession(config('51,52,53,54', team('14,14,14,14'), team('15,15,15,15')));
    session.start();
    expect(session.submit('move 1').ok).toBe(true);
    const result = session.forfeit();
    expect(result.ended).toBe(true);
    expect(result.winner).toBe('p2');
    expect(result.request).toBeNull();
    expect(result.events.some((e) => e.kind === 'win' && e.winner === 'p2')).toBe(true);
    expect(session.ended).toBe(true);
    expect(session.snapshot().winner).toBe('p2');
    expect(session.submit('move 1').ok).toBe(false);
    // Forfeiting again is a no-op that reports the same outcome.
    expect(session.forfeit().winner).toBe('p2');
    // A forfeited save restores as a finished battle.
    const restored = await restoreBattleSession(session.serialize());
    expect(restored.ended).toBe(true);
    expect(restored.snapshot().winner).toBe('p2');
  });

  it('keeps identical trainer names distinct so the winner resolves', async () => {
    const session = await createBattleSession(config('1,2,3,4', [GARCHOMP], [MAGIKARP], { p1: 'Red', p2: 'Red' }));
    session.start();
    const result = session.submit('move 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ended).toBe(true);
    expect(result.winner).toBe('p1');
    expect(result.snapshot.sides.p1.name).not.toBe(result.snapshot.sides.p2.name);
  });

  it('generates a seed when none is configured and keeps it in the config', async () => {
    const cfg = config('', team('16,16,16,16'), team('17,17,17,17'));
    delete cfg.seed;
    const session = await createBattleSession(cfg);
    expect(session.config.seed).toMatch(/^\d+,\d+,\d+,\d+$/);
    expect(session.serialize().config.seed).toBe(session.config.seed);
  });

  it('Revival Blessing: the player is asked which FAINTED Pokémon to revive and the engine accepts it', async () => {
    const session = await createBattleSession(config('1,2,3,4', [KARP_L1, PAWMOT, GOLDEEN], [CHOMP_EQ]), { ai: scripted('move 1', 'move 2', 'move 2', 'move 2') });
    session.start();
    expect(submitOk(session, 'move 1').request?.kind).toBe('switch'); // Magikarp faints to Earthquake
    expect(submitOk(session, 'switch 2').snapshot.sides.p1.active?.ident).toBe('p1: Pawmot');
    const afterBlessing = submitOk(session, 'move 1'); // Revival Blessing
    expect(afterBlessing.request).toMatchObject({ kind: 'switch', reviving: true });
    // Request order is active-first: Pawmot (1), fainted Magikarp (2), healthy Goldeen (3).
    const healthy = session.submit('switch 3');
    expect(healthy.ok).toBe(false);
    if (!healthy.ok) {
      expect(healthy.error).toContain('fainted');
      expect(healthy.request).toMatchObject({ kind: 'switch', reviving: true });
    }
    expect(session.submit('pass').ok).toBe(false);
    const revived = submitOk(session, 'switch 2');
    const karp = revived.snapshot.sides.p1.pokemon[1];
    expect(karp.ident).toBe('p1: Magikarp');
    expect(karp.fainted).toBe(false);
    expect(karp.hp).toBe(Math.floor(karp.maxhp / 2));
    expect(karp.active).toBe(false);
    expect(revived.snapshot.sides.p1.active?.ident).toBe('p1: Pawmot');
    expect(revived.request?.kind).toBe('move');
    expect(revived.events.some((e) => e.kind === 'heal' && e.ident === 'p1: Magikarp')).toBe(true);
    expect(session.serialize().inputLog.filter((l) => l.endsWith(' pass'))).toEqual([]);
    await expectRestoreEqual(session);
  });

  it('ordinary forced switches still exclude fainted Pokémon (reviving flag false)', async () => {
    const session = await createBattleSession(config('1,2,3,4', [MAGIKARP, PIKACHU, KARP_L1], [GARCHOMP]));
    session.start();
    const result = submitOk(session, 'move 1');
    expect(result.request).toEqual(expect.objectContaining({ kind: 'switch', reviving: false }));
    expect(session.submit('switch 1').ok).toBe(false);
    expect(submitOk(session, 'switch 2').request?.kind).toBe('move');
  });

  it('start() lets the opponent resolve a forced switch during the send-outs (Eject Pack vs Intimidate)', async () => {
    const gyarados: PokemonSet = { ...BASE, name: 'Gyarados', species: 'Gyarados', ability: 'Intimidate', moves: ['Splash'], gender: 'M' };
    const ejectKarp: PokemonSet = { ...MAGIKARP, item: 'Eject Pack' };
    const session = await createBattleSession(config('1,2,3,4', [gyarados, MAGIKARP], [ejectKarp, GOLDEEN]), { ai: scripted('switch 2') });
    const first = session.start();
    expect(first.request?.kind).toBe('move');
    expect(first.snapshot.turn).toBe(1);
    expect(first.snapshot.sides.p2.active?.ident).toBe('p2: Goldeen');
    const kinds = first.events.map((e) => e.kind);
    expect(kinds.indexOf('enditem')).toBeGreaterThan(-1);
    const goldeenIn = first.events.findIndex((e) => e.kind === 'switch' && e.ident === 'p2: Goldeen');
    expect(goldeenIn).toBeGreaterThan(kinds.indexOf('enditem'));
    expect(kinds.indexOf('turn')).toBeGreaterThan(goldeenIn);
    expect(submitOk(session, 'move 1').snapshot.turn).toBe(2);
    await expectRestoreEqual(session);
  });

  it('a refused choice hands back the engine\'s current request (hidden trap revealed)', async () => {
    const wobbuffet: PokemonSet = { ...BASE, name: 'Wobbuffet', species: 'Wobbuffet', ability: 'Shadow Tag', moves: ['Splash'], gender: 'M' };
    const session = await createBattleSession(config('1,2,3,4', [MAGIKARP, GOLDEEN], [wobbuffet]));
    const first = session.start();
    expect(first.request?.kind === 'move' && first.request.active.trapped).toBe(false);
    const refused = session.submit('switch 2');
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toContain('trapped');
      expect(refused.request?.kind).toBe('move');
      if (refused.request?.kind === 'move') expect(refused.request.active.trapped).toBe(true);
    }
    expect(submitOk(session, 'move 1').snapshot.turn).toBe(2);
    const ended = session.forfeit();
    expect(ended.ended).toBe(true);
    const afterEnd = session.submit('move 1');
    expect(afterEnd.ok).toBe(false);
    if (!afterEnd.ok) expect(afterEnd.request).toBeNull();
  });

  it('surfaces Ultra Burst and accepts "move N ultra"', async () => {
    const necrozma: PokemonSet = { ...BASE, name: 'Necrozma', species: 'Necrozma-Dusk-Mane', ability: 'Prism Armor', item: 'Ultranecrozium Z', moves: ['Sunsteel Strike', 'Splash'], gender: 'N' };
    const session = await createBattleSession(config('1,2,3,4', [necrozma, GOLDEEN], [MAGIKARP]));
    const first = session.start();
    expect(first.request?.kind === 'move' && first.request.active.canUltraBurst).toBe(true);
    expect(first.request?.kind === 'move' && first.request.active.canMegaEvo).toBe(false);
    expect(describeChoice('move 1 ultra', first.request)).toBe('Sunsteel Strike (Ultra Burst)');
    const burst = submitOk(session, 'move 1 ultra');
    expect(burst.snapshot.sides.p1.active?.species).toBe('Necrozma-Ultra');
    expect(burst.request?.kind === 'move' && burst.request.active.canUltraBurst).toBe(false);
    await expectRestoreEqual(session);
  });

  describe('Illusion idents', () => {
    /** Every event ident of `side` must name a Pokémon of that side: before a `replace` in the previous snapshot, after it in the new one. */
    function expectIdentsResolve(events: BattleEvent[], side: 'p1' | 'p2', before: PokemonView[], after: PokemonView[]) {
      let pool = new Set(before.map((p) => p.ident));
      const seen: string[] = [];
      for (const e of events) {
        if (!('ident' in e) || e.side !== side) continue;
        if (e.kind === 'formechange') pool = new Set(after.map((p) => p.ident));
        if (e.kind === 'damage' || e.kind === 'switch' || e.kind === 'faint' || e.kind === 'heal') {
          seen.push(`${e.kind}:${e.ident}`);
          expect(pool.has(e.ident)).toBe(true);
        }
      }
      return seen;
    }

    const ZOROARK: PokemonSet = { ...BASE, name: 'Zoroark', species: 'Zoroark', ability: 'Illusion', moves: ['Night Slash', 'Splash'], gender: 'M' };

    it('opponent: snapshot idents follow the disguise and resolve after the reveal', async () => {
      // A level-50 Garchomp breaks the illusion without KOing Zoroark.
      const session = await createBattleSession(config('1,2,3,4', [{ ...CHOMP_EQ, level: 50 }], [ZOROARK, MAGIKARP]), { ai: scripted('move 2', 'move 2') });
      const first = session.start();
      const p2 = first.snapshot.sides.p2;
      expect(p2.pokemon.map((p) => p.ident)).toEqual(['p2: Magikarp', 'p2: Magikarp']);
      expect(p2.active).toMatchObject({ ident: 'p2: Magikarp', species: 'Magikarp', slot: 0 });
      expect(p2.active?.maxhp).toBe(p2.pokemon[0].maxhp);
      expect(p2.pokemon[0].maxhp).not.toBe(p2.pokemon[1].maxhp);
      expectIdentsResolve(first.events, 'p2', p2.pokemon, p2.pokemon);

      const hit = submitOk(session, 'move 1'); // Earthquake breaks the illusion
      const after = hit.snapshot.sides.p2;
      expect(after.pokemon.map((p) => p.ident)).toEqual(['p2: Zoroark', 'p2: Magikarp']);
      expect(after.active).toMatchObject({ ident: 'p2: Zoroark', species: 'Zoroark', fainted: false });
      expect(after.pokemon[0].hp).toBeGreaterThan(0);
      expect(after.pokemon[0].hp).toBeLessThan(after.pokemon[0].maxhp);
      const seen = expectIdentsResolve(hit.events, 'p2', p2.pokemon, after.pokemon);
      expect(seen).toContain('damage:p2: Magikarp');
      expect(hit.events.some((e) => e.kind === 'formechange' && e.ident === 'p2: Zoroark' && e.species === 'Zoroark')).toBe(true);
      const damage = hit.events.find((e) => e.kind === 'damage' && e.side === 'p2');
      expect(damage && damage.kind === 'damage' ? { hp: damage.hp, maxhp: damage.maxhp } : null).toEqual({ hp: after.pokemon[0].hp, maxhp: after.pokemon[0].maxhp });
      expect(after.pokemon[1].hp).toBe(after.pokemon[1].maxhp);
      await expectRestoreEqual(session);
    });

    it('opponent: a disguised Zoroark that faints on the reveal turn resolves too', async () => {
      const session = await createBattleSession(config('1,2,3,4', [{ ...CHOMP_EQ, item: 'Choice Band' }], [{ ...ZOROARK, level: 5 }, MAGIKARP]), { ai: scripted('move 2', 'switch 2') });
      const first = session.start();
      const before = first.snapshot.sides.p2.pokemon;
      const hit = submitOk(session, 'move 1');
      const after = hit.snapshot.sides.p2.pokemon;
      // The replacement takes slot 0 (request order is active-first); the real Zoroark is the fainted one.
      expect(after.map((p) => p.ident)).toEqual(['p2: Magikarp', 'p2: Zoroark']);
      expect(after[1]).toMatchObject({ ident: 'p2: Zoroark', species: 'Zoroark', fainted: true, hp: 0 });
      const seen = expectIdentsResolve(hit.events, 'p2', before, after);
      expect(seen.some((s) => s.startsWith('faint:'))).toBe(true);
      expect(seen.filter((s) => s.startsWith('switch:'))).toEqual(['switch:p2: Magikarp']);
      expect(hit.snapshot.sides.p2.active).toMatchObject({ ident: 'p2: Magikarp', species: 'Magikarp', fainted: false, slot: 0 });
      expect(hit.snapshot.sides.p2.active?.hp).toBe(hit.snapshot.sides.p2.active?.maxhp);
    });

    it("player: idents name the disguise while the party menu keeps the real Pokémon", async () => {
      const session = await createBattleSession(config('1,2,3,4', [ZOROARK, MAGIKARP], [CHOMP_EQ]), { ai: scripted('move 1', 'move 1') });
      const first = session.start();
      const p1 = first.snapshot.sides.p1;
      expect(p1.pokemon.map((p) => p.ident)).toEqual(['p1: Magikarp', 'p1: Magikarp']);
      expect(p1.pokemon.map((p) => p.species)).toEqual(['Zoroark', 'Magikarp']);
      expect(p1.active).toMatchObject({ ident: 'p1: Magikarp', species: 'Zoroark', name: 'Zoroark', slot: 0 });
      expect(first.request?.kind === 'move' && first.request.team.map((p) => p.name)).toEqual(['Zoroark', 'Magikarp']);
      expectIdentsResolve(first.events, 'p1', p1.pokemon, p1.pokemon);
      const hit = submitOk(session, 'move 2');
      const after = hit.snapshot.sides.p1;
      expect(after.pokemon.map((p) => p.ident)).toEqual(['p1: Zoroark', 'p1: Magikarp']);
      const seen = expectIdentsResolve(hit.events, 'p1', p1.pokemon, after.pokemon);
      expect(seen).toContain('damage:p1: Magikarp');
      expect(after.pokemon[1].hp).toBe(after.pokemon[1].maxhp);
      await expectRestoreEqual(session);
    });
  });

  it('describeChoice labels moves and switches', async () => {
    const session = await createBattleSession(config('1,2,3,4', [GARCHOMP, PIKACHU], [MAGIKARP]));
    const request = session.start().request;
    expect(describeChoice('move 1', request)).toBe('Earthquake');
    expect(describeChoice('move 2 mega', request)).toBe('Dragon Claw (Mega Evolution)');
    expect(describeChoice('move 1 zmove', request)).toBe('Earthquake (Z-Move)');
    expect(describeChoice('move earthquake', request)).toBe('Earthquake');
    expect(describeChoice('switch 2', request)).toBe('Switch → Pikachu');
    expect(describeChoice('switch 2', null)).toBe('Switch → #2');
    expect(describeChoice('pass', null)).toBe('Pass');
  });
});
