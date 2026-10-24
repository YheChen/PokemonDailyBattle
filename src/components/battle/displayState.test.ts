import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleSetup, BattleSnapshot, PokemonView, SideID } from '@/lib/battle/types';
import { createBattleSession } from '@/lib/battle';
import {
  applyEvent, applyEvents, buildBattleResult, displayFromSnapshot, inTeamOrder, moveTypeFor, sideConditionLabel,
  weatherGroup, withoutActives,
} from './displayState';
import { createPlanContext, planEvent, planEvents, speedFactor } from './animationQueue';

function mon(side: SideID, slot: number, species: string, extra: Partial<PokemonView> = {}): PokemonView {
  return {
    ident: `${side}: ${species}`,
    side,
    slot,
    speciesId: species.toLowerCase(),
    species,
    name: species,
    level: 100,
    gender: 'M',
    shiny: false,
    hp: 300,
    maxhp: 300,
    status: '',
    fainted: false,
    active: slot === 0,
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    types: ['Dragon', 'Ground'],
    item: 'Leftovers',
    ability: 'Rough Skin',
    moves: [
      { id: 'earthquake', name: 'Earthquake', type: 'Ground', category: 'Physical', basePower: 100, accuracy: 100, pp: 16, maxpp: 16, disabled: false, target: 'allAdjacent', priority: 0, desc: '' },
      { id: 'swordsdance', name: 'Swords Dance', type: 'Normal', category: 'Status', basePower: 0, accuracy: true, pp: 32, maxpp: 32, disabled: false, target: 'self', priority: 0, desc: '' },
    ],
    volatiles: [],
    stats: { atk: 359, def: 226, spa: 176, spd: 206, spe: 333 },
    baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
    ...extra,
  };
}

function snapshot(): BattleSnapshot {
  const p1 = [mon('p1', 0, 'Garchomp'), mon('p1', 1, 'Lucario'), mon('p1', 2, 'Milotic')];
  const p2 = [mon('p2', 0, 'Spiritomb'), mon('p2', 1, 'Roserade'), mon('p2', 2, 'Gastrodon', { fainted: true, hp: 0 })];
  return {
    turn: 3,
    sides: {
      p1: { id: 'p1', name: 'Red', pokemon: p1, active: p1[0], sideConditions: {}, pokemonLeft: 3 },
      p2: { id: 'p2', name: 'Cynthia', pokemon: p2, active: p2[0], sideConditions: { stealthrock: 1 }, pokemonLeft: 2 },
    },
    field: { weather: '', terrain: '', pseudoWeather: [] },
    ended: false,
    winner: null,
  };
}

const setup: BattleSetup = {
  mode: 'free',
  saveKey: null,
  trainerId: 'cynthia',
  config: {
    seed: '1,2,3,4',
    player: {
      name: 'Red',
      team: [
        { name: 'Milotic', species: 'Milotic', item: '', ability: 'Marvel Scale', moves: [], gender: '', nature: 'Bold', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100 },
        { name: 'Garchomp', species: 'Garchomp', item: '', ability: 'Rough Skin', moves: [], gender: '', nature: 'Jolly', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100 },
        { name: 'Lucario', species: 'Lucario', item: '', ability: 'Justified', moves: [], gender: '', nature: 'Jolly', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100 },
      ],
    },
    opponent: { name: 'Cynthia', team: [], difficulty: 'champion', trainerId: 'cynthia' },
  },
};

describe('displayFromSnapshot', () => {
  it('copies actives, parties, side conditions and field', () => {
    const d = displayFromSnapshot(snapshot());
    expect(d.turn).toBe(3);
    expect(d.sides.p1.active?.species).toBe('Garchomp');
    expect(d.sides.p2.active?.species).toBe('Spiritomb');
    expect(d.sides.p1.party).toHaveLength(3);
    expect(d.sides.p2.sideConditions).toEqual({ stealthrock: 1 });
    expect(d.sides.p2.party[2].fainted).toBe(true);
    // Copies, not references.
    d.sides.p1.active!.hp = 1;
    expect(d.sides.p1.party[0].hp).toBe(300);
  });

  it('withoutActives clears the field but keeps the parties', () => {
    const d = withoutActives(displayFromSnapshot(snapshot()));
    expect(d.sides.p1.active).toBeNull();
    expect(d.sides.p2.active).toBeNull();
    expect(d.sides.p1.party).toHaveLength(3);
  });
});

describe('applyEvent', () => {
  const base = () => displayFromSnapshot(snapshot());

  it('damage sets the displayed hp of the active and the party entry', () => {
    const d = applyEvent(base(), { kind: 'damage', side: 'p2', ident: 'p2: Spiritomb', hp: 120, maxhp: 300, status: '', text: '' });
    expect(d.sides.p2.active?.hp).toBe(120);
    expect(d.sides.p2.party[0].hp).toBe(120);
    expect(d.sides.p1.active?.hp).toBe(300);
  });

  it('damage with a status in the hp string keeps the status; heal restores', () => {
    let d = applyEvent(base(), { kind: 'damage', side: 'p1', ident: 'p1: Garchomp', hp: 250, maxhp: 300, status: 'brn', from: 'brn', text: 'Garchomp was hurt by its burn!' });
    expect(d.sides.p1.active?.status).toBe('brn');
    d = applyEvent(d, { kind: 'heal', side: 'p1', ident: 'p1: Garchomp', hp: 268, maxhp: 300, status: 'brn', from: 'item: Leftovers', text: '' });
    expect(d.sides.p1.active?.hp).toBe(268);
  });

  it('sethp sets hp without touching status', () => {
    const d = applyEvent(base(), { kind: 'sethp', side: 'p1', ident: 'p1: Garchomp', hp: 150, maxhp: 300, text: '' });
    expect(d.sides.p1.active?.hp).toBe(150);
    expect(d.sides.p1.active?.status).toBe('');
  });

  it('faint marks the Pokémon fainted with 0 hp', () => {
    const d = applyEvent(base(), { kind: 'faint', side: 'p2', ident: 'p2: Spiritomb', text: 'The opposing Spiritomb fainted!' });
    expect(d.sides.p2.active?.fainted).toBe(true);
    expect(d.sides.p2.active?.hp).toBe(0);
    expect(d.sides.p2.party[0].fainted).toBe(true);
  });

  it('switch replaces the active Pokémon and resets boosts/volatiles', () => {
    let d = applyEvent(base(), { kind: 'boost', side: 'p1', ident: 'p1: Garchomp', stat: 'atk', amount: 2, text: '' });
    d = applyEvent(d, { kind: 'start', side: 'p1', ident: 'p1: Garchomp', effect: 'Substitute', text: '' });
    expect(d.sides.p1.active?.boosts.atk).toBe(2);
    d = applyEvent(d, {
      kind: 'switch', side: 'p1', ident: 'p1: Lucario', species: 'Lucario', level: 100, gender: 'M', shiny: false, hp: 280, maxhp: 281, status: 'par', drag: false, text: 'Go! Lucario!',
    });
    expect(d.sides.p1.active?.species).toBe('Lucario');
    expect(d.sides.p1.active?.hp).toBe(280);
    expect(d.sides.p1.active?.maxhp).toBe(281);
    expect(d.sides.p1.active?.status).toBe('par');
    expect(d.sides.p1.active?.boosts.atk).toBe(0);
    expect(d.sides.p1.active?.volatiles).toEqual([]);
    expect(d.sides.p1.active?.moves.map((m) => m.id)).toContain('earthquake');
    // The party entry mirrors the new hp.
    expect(d.sides.p1.party[1].hp).toBe(280);
    // The previous active keeps its own hp.
    expect(d.sides.p1.party[0].hp).toBe(300);
  });

  it('switch to an unknown ident (Illusion) still shows the event species', () => {
    const d = applyEvent(base(), {
      kind: 'switch', side: 'p2', ident: 'p2: Zoroark', species: 'Zoroark', level: 100, gender: 'F', shiny: true, hp: 200, maxhp: 250, status: '', drag: true, text: '',
    });
    expect(d.sides.p2.active?.species).toBe('Zoroark');
    expect(d.sides.p2.active?.name).toBe('Zoroark');
    expect(d.sides.p2.active?.shiny).toBe(true);
    expect(d.sides.p2.party).toHaveLength(3);
  });

  it('Illusion reveal (|replace|) re-keys the active Pokémon so later events patch it, not the benched look-alike', () => {
    // The opponent's Zoroark (slot 0) was snapshotted under the Gyarados identity (slot 2 is the real one).
    const p2 = [mon('p2', 0, 'Gyarados'), mon('p2', 1, 'Roserade'), mon('p2', 2, 'Gyarados')];
    const snap = snapshot();
    snap.sides.p2 = { id: 'p2', name: 'Cynthia', pokemon: p2, active: p2[0], sideConditions: {}, pokemonLeft: 3 };
    let d = displayFromSnapshot(snap);
    d = applyEvent(d, { kind: 'damage', side: 'p2', ident: 'p2: Gyarados', hp: 180, maxhp: 300, status: '', text: '' });
    d = applyEvent(d, { kind: 'formechange', side: 'p2', ident: 'p2: Zoroark', species: 'Zoroark', permanent: false, text: 'The Illusion wore off!' });
    expect(d.sides.p2.active?.ident).toBe('p2: Zoroark');
    expect(d.sides.p2.active?.species).toBe('Zoroark');
    expect(d.sides.p2.active?.name).toBe('Zoroark');
    expect(d.sides.p2.party.map((p) => p.ident)).toEqual(['p2: Zoroark', 'p2: Roserade', 'p2: Gyarados']);
    d = applyEvent(d, { kind: 'damage', side: 'p2', ident: 'p2: Zoroark', hp: 40, maxhp: 300, status: '', text: '' });
    expect(d.sides.p2.active?.hp).toBe(40);
    expect(d.sides.p2.party[0].hp).toBe(40);
    expect(d.sides.p2.party[2].hp).toBe(180); // only the final snapshot corrects the benched look-alike
    d = applyEvent(d, { kind: 'faint', side: 'p2', ident: 'p2: Zoroark', text: '' });
    expect(d.sides.p2.active?.fainted).toBe(true);
    expect(d.sides.p2.party[2].fainted).toBe(false);
    // A plain forme change of the active Pokémon still patches in place.
    const e = applyEvent(base(), { kind: 'formechange', side: 'p1', ident: 'p1: Garchomp', species: 'Garchomp-Mega', permanent: true, text: '' });
    expect(e.sides.p1.active?.ident).toBe('p1: Garchomp');
    expect(e.sides.p1.active?.species).toBe('Garchomp-Mega');
    // The player's own Zoroark: the party already lists it under its real ident, so nothing is renamed there.
    let own = applyEvent(base(), {
      kind: 'switch', side: 'p1', ident: 'p1: Milotic', species: 'Milotic', level: 100, gender: 'M', shiny: false, hp: 300, maxhp: 300, status: '', drag: false, text: '',
    });
    own = applyEvent(own, { kind: 'formechange', side: 'p1', ident: 'p1: Lucario', species: 'Lucario', permanent: false, text: '' });
    expect(own.sides.p1.active?.ident).toBe('p1: Lucario');
    expect(own.sides.p1.party.map((p) => p.ident)).toEqual(['p1: Garchomp', 'p1: Lucario', 'p1: Milotic']);
  });

  it('boost accumulates, clamps to ±6 and clearboost resets', () => {
    let d = base();
    for (let i = 0; i < 4; i++) d = applyEvent(d, { kind: 'boost', side: 'p1', ident: 'p1: Garchomp', stat: 'atk', amount: 2, text: '' });
    expect(d.sides.p1.active?.boosts.atk).toBe(6);
    d = applyEvent(d, { kind: 'boost', side: 'p1', ident: 'p1: Garchomp', stat: 'spe', amount: -1, text: '' });
    expect(d.sides.p1.active?.boosts.spe).toBe(-1);
    d = applyEvent(d, { kind: 'clearboost', side: 'p1', ident: 'p1: Garchomp', text: '' });
    expect(d.sides.p1.active?.boosts.atk).toBe(0);
    expect(d.sides.p1.active?.boosts.spe).toBe(0);
  });

  it('status and curestatus update the chip', () => {
    let d = applyEvent(base(), { kind: 'status', side: 'p2', ident: 'p2: Spiritomb', status: 'tox', text: '' });
    expect(d.sides.p2.active?.status).toBe('tox');
    expect(d.sides.p2.party[0].status).toBe('tox');
    d = applyEvent(d, { kind: 'curestatus', side: 'p2', ident: 'p2: Spiritomb', status: 'tox', text: '' });
    expect(d.sides.p2.active?.status).toBe('');
  });

  it('weather, terrain, pseudo-weather and side conditions update the indicators', () => {
    let d = applyEvent(base(), { kind: 'weather', weather: 'RainDance', upkeep: false, text: '' });
    expect(d.field.weather).toBe('raindance');
    expect(weatherGroup(d.field.weather)).toBe('rain');
    d = applyEvent(d, { kind: 'weather', weather: '', upkeep: false, text: '' });
    expect(d.field.weather).toBe('');
    d = applyEvent(d, { kind: 'field', effect: 'Electric Terrain', start: true, text: '' });
    expect(d.field.terrain).toBe('electricterrain');
    d = applyEvent(d, { kind: 'field', effect: 'Trick Room', start: true, text: '' });
    expect(d.field.pseudoWeather).toEqual(['trickroom']);
    d = applyEvent(d, { kind: 'field', effect: 'Electric Terrain', start: false, text: '' });
    expect(d.field.terrain).toBe('');
    d = applyEvent(d, { kind: 'field', effect: 'Trick Room', start: false, text: '' });
    expect(d.field.pseudoWeather).toEqual([]);
    d = applyEvent(d, { kind: 'side', side: 'p1', condition: 'Spikes', start: true, text: '' });
    d = applyEvent(d, { kind: 'side', side: 'p1', condition: 'Spikes', start: true, text: '' });
    expect(d.sides.p1.sideConditions.spikes).toBe(2);
    expect(sideConditionLabel('spikes', 2)).toBe('Spikes ×2');
    d = applyEvent(d, { kind: 'side', side: 'p1', condition: 'Reflect', start: true, text: '' });
    expect(d.sides.p1.sideConditions.reflect).toBe(1);
    d = applyEvent(d, { kind: 'side', side: 'p1', condition: 'Reflect', start: false, text: '' });
    expect(d.sides.p1.sideConditions.reflect).toBeUndefined();
    d = applyEvent(d, { kind: 'side', side: 'p2', condition: 'Stealth Rock', start: false, text: '' });
    expect(d.sides.p2.sideConditions.stealthrock).toBeUndefined();
  });

  it('formechange / mega / terastallize / item / ability / win', () => {
    let d = applyEvent(base(), { kind: 'mega', side: 'p1', ident: 'p1: Garchomp', species: 'Garchomp-Mega', text: '' });
    expect(d.sides.p1.active?.species).toBe('Garchomp-Mega');
    d = applyEvent(d, { kind: 'terastallize', side: 'p1', ident: 'p1: Garchomp', type: 'Steel', text: '' });
    expect(d.sides.p1.active?.terastallized).toBe('Steel');
    d = applyEvent(d, { kind: 'enditem', side: 'p1', ident: 'p1: Garchomp', item: 'Leftovers', text: '' });
    expect(d.sides.p1.active?.item).toBe('');
    d = applyEvent(d, { kind: 'ability', side: 'p2', ident: 'p2: Spiritomb', ability: 'Pressure', text: '' });
    expect(d.sides.p2.active?.ability).toBe('Pressure');
    d = applyEvent(d, { kind: 'win', winner: 'p1', text: 'Red won the battle!' });
    expect(d.ended).toBe(true);
    expect(d.winner).toBe('p1');
  });

  it('never mutates the input state', () => {
    const before = base();
    const frozen = JSON.stringify(before);
    applyEvents(before, [
      { kind: 'damage', side: 'p2', ident: 'p2: Spiritomb', hp: 1, maxhp: 300, status: '', text: '' },
      { kind: 'boost', side: 'p1', ident: 'p1: Garchomp', stat: 'atk', amount: 2, text: '' },
      { kind: 'side', side: 'p1', condition: 'Spikes', start: true, text: '' },
      { kind: 'weather', weather: 'Sandstorm', upkeep: false, text: '' },
    ]);
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it('moveTypeFor finds the type from the active Pokémon move list', () => {
    const d = base();
    expect(moveTypeFor(d, 'p1', 'Earthquake')).toBe('Ground');
    expect(moveTypeFor(d, 'p1', 'Flamethrower')).toBeNull();
  });
});

describe('buildBattleResult', () => {
  it('computes the result from the final snapshot in team order', () => {
    const snap = snapshot();
    snap.ended = true;
    snap.winner = 'p1';
    snap.turn = 17;
    snap.sides.p1.pokemon[1].fainted = true;
    const r = buildBattleResult(snap, setup, { forfeited: false, finishedAt: '2026-10-23T00:00:00.000Z' });
    expect(r.won).toBe(true);
    expect(r.forfeited).toBe(false);
    expect(r.turns).toBe(17);
    expect(r.playerRemaining).toBe(2);
    expect(r.opponentRemaining).toBe(2);
    // Team order (Milotic, Garchomp, Lucario) rather than request order (Garchomp, Lucario, Milotic).
    expect(r.playerTeamStatus).toEqual([
      { species: 'Milotic', fainted: false },
      { species: 'Garchomp', fainted: false },
      { species: 'Lucario', fainted: true },
    ]);
    expect(r.opponentTeamStatus.map((p) => p.fainted)).toEqual([false, false, true]);
    expect(r.trainerId).toBe('cynthia');
    expect(r.mode).toBe('free');
    expect(r.finishedAt).toBe('2026-10-23T00:00:00.000Z');
  });

  it('a forfeit is a loss', () => {
    const snap = snapshot();
    snap.ended = true;
    snap.winner = 'p2';
    const r = buildBattleResult(snap, setup, { forfeited: true });
    expect(r.won).toBe(false);
    expect(r.forfeited).toBe(true);
    expect(Number.isNaN(Date.parse(r.finishedAt))).toBe(false);
  });

  it('inTeamOrder falls back to request order for unknown Pokémon', () => {
    const list = [mon('p1', 0, 'A'), mon('p1', 1, 'B')];
    expect(inTeamOrder(list, [{ species: 'B' }]).map((p) => p.species)).toEqual(['B', 'A']);
    expect(inTeamOrder(list, undefined).map((p) => p.species)).toEqual(['A', 'B']);
  });
});

describe('planEvent', () => {
  it('shows crit / super-effective texts after the damage step, with a type-colored burst', () => {
    const ctx = createPlanContext();
    const state = displayFromSnapshot(snapshot());
    const events: BattleEvent[] = [
      { kind: 'move', side: 'p1', ident: 'p1: Garchomp', move: 'Earthquake', target: 'p2: Spiritomb', text: 'Garchomp used Earthquake!' },
      { kind: 'crit', side: 'p2', ident: 'p2: Spiritomb', text: 'A critical hit!' },
      { kind: 'effectiveness', side: 'p2', ident: 'p2: Spiritomb', effectiveness: 'super', text: "It's super effective!" },
      { kind: 'damage', side: 'p2', ident: 'p2: Spiritomb', hp: 40, maxhp: 300, status: '', text: '' },
    ];
    const steps = planEvents(events, state, ctx);
    const texts = steps.map((s) => s.text);
    expect(texts[0]).toBe('Garchomp used Earthquake!');
    expect(steps[0].fx?.sprite).toEqual({ side: 'p1', anim: 'lunge' });
    const damageIdx = steps.findIndex((s) => s.event?.kind === 'damage');
    expect(damageIdx).toBeGreaterThan(0);
    expect(steps[damageIdx].fx?.sprite).toEqual({ side: 'p2', anim: 'hit-strong' });
    expect(steps[damageIdx].fx?.burst?.color.toLowerCase()).toBe('#e2bf65'); // Ground
    expect(steps[damageIdx].fx?.flash).toBe('crit');
    expect(texts.slice(damageIdx + 1)).toEqual(['A critical hit!', "It's super effective!"]);
  });

  it('indirect damage (burn, Leftovers) has no hit effect; status moves do not lunge', () => {
    const state = displayFromSnapshot(snapshot());
    const ctx = createPlanContext();
    const dance = planEvent({ kind: 'move', side: 'p1', ident: 'p1: Garchomp', move: 'Swords Dance', text: 'Garchomp used Swords Dance!' }, state, ctx);
    expect(dance[0].fx).toBeNull();
    const burn = planEvent({ kind: 'damage', side: 'p1', ident: 'p1: Garchomp', hp: 250, maxhp: 300, status: 'brn', from: 'brn', text: 'Garchomp was hurt by its burn!' }, state, ctx);
    expect(burn[0].fx).toBeNull();
    expect(burn[0].text).toBe('Garchomp was hurt by its burn!');
  });

  it('splits a switch with a withdraw line into switch-out + switch-in', () => {
    const state = displayFromSnapshot(snapshot());
    const steps = planEvent(
      { kind: 'switch', side: 'p2', ident: 'p2: Roserade', species: 'Roserade', level: 100, gender: 'F', shiny: false, hp: 300, maxhp: 300, status: '', drag: false, text: 'Cynthia withdrew Spiritomb!\nCynthia sent out Roserade!' },
      state,
      createPlanContext(),
    );
    expect(steps).toHaveLength(2);
    expect(steps[0].fx?.sprite?.anim).toBe('switch-out');
    expect(steps[0].event).toBeNull();
    expect(steps[1].fx?.sprite?.anim).toBe('switch-in');
    expect(steps[1].event?.kind).toBe('switch');
    expect(steps[1].text).toBe('Cynthia sent out Roserade!');
  });

  it('speed factors', () => {
    expect(speedFactor('normal')).toBe(1);
    expect(speedFactor('fast')).toBe(0.45);
    expect(speedFactor('instant')).toBe(0);
  });
});

describe('with the real engine', () => {
  it('applying every event of a turn lands on the snapshot hp values', async () => {
    const [{ TeamGenerators }, { PRNG }] = await Promise.all([import('@pkmn/randoms'), import('@pkmn/sim')]);
    const team = (seed: string) =>
      TeamGenerators.getTeamGenerator('gen9randombattle', new PRNG(seed as `${number},${number},${number},${number}`))
        .getTeam()
        .map((s) => ({ ...s, level: 100 }));
    const session = await createBattleSession({
      seed: '11,22,33,44',
      player: { name: 'Red', team: team('1,2,3,4') },
      opponent: { name: 'Cynthia', team: team('5,6,7,8'), difficulty: 'normal' },
    });
    const start = session.start();
    let display = applyEvents(withoutActives(displayFromSnapshot(session.snapshot())), start.events);
    expect(display.sides.p1.active?.species).toBe(start.snapshot.sides.p1.active?.species);
    expect(display.sides.p2.active?.species).toBe(start.snapshot.sides.p2.active?.species);

    let prev = start.snapshot;
    for (let turn = 0; turn < 30 && !session.ended; turn++) {
      const req = session.request();
      if (!req || req.kind === 'wait') break;
      const choice = req.kind === 'switch'
        ? `switch ${req.team.findIndex((p) => !p.active && !p.fainted) + 1}`
        : `move ${req.active.moves.findIndex((m) => !m.disabled) + 1}`;
      const res = session.submit(choice);
      expect(res.ok).toBe(true);
      if (!res.ok) break;
      display = applyEvents(displayFromSnapshot(prev), res.events);
      const snap = res.snapshot;
      for (const side of ['p1', 'p2'] as const) {
        const shown = display.sides[side].active;
        const real = snap.sides[side].active;
        if (!real) continue;
        expect(shown?.ident).toBe(real.ident);
        expect(shown?.hp).toBe(real.hp);
        expect(shown?.status).toBe(real.status);
        expect(shown?.fainted).toBe(real.fainted);
      }
      expect(display.turn).toBe(snap.turn);
      expect(display.field.weather).toBe(snap.field.weather);
      expect(display.field.terrain).toBe(snap.field.terrain);
      prev = snap;
    }
  });
});
