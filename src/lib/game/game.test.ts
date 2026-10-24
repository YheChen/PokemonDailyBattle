import { describe, expect, it } from 'vitest';
import type { PRNGSeed } from '@pkmn/sim';
import { TRAINERS, bossRushOrder, getTrainer } from '@/data/trainers';
import type { BattleResult } from '@/lib/battle/types';
import { DEFAULT_FORMAT, GEN9_ONLY_FORMAT } from '@/lib/battle/types';
import { listLegalChoices } from '@/lib/battle/legal';
import {
  GIMMICK_ITEM_IDS, MEGA_STONE_IDS, Z_CRYSTAL_IDS, isGen9OnlyFormat, isGimmickItem, replacementItem, stripGimmickItems, trainerToSets, fillEvs, fillIvs,
} from './trainerTeam';
import { buildBattleSetup, difficultyFor, forfeitResult, forfeitResultFromSave, remainingCounts, outcomeLabel, winPercent } from './results';
import { buildShareText, resultEmojiGrid } from './share';
import { advance, currentTrainer, finish, isComplete, startRun, totalStages, withTeam, stageTeamSeed, isValidRun } from './bossRush';

function makeResult(overrides: Partial<BattleResult> = {}): BattleResult {
  return {
    won: true,
    forfeited: false,
    turns: 14,
    playerRemaining: 4,
    opponentRemaining: 0,
    playerTeamStatus: [
      { species: 'Garchomp', fainted: false },
      { species: 'Rotom-Wash', fainted: false },
      { species: 'Heatran', fainted: true },
      { species: 'Clefable', fainted: false },
      { species: 'Lucario', fainted: true },
      { species: 'Gliscor', fainted: false },
    ],
    opponentTeamStatus: Array.from({ length: 6 }, (_, i) => ({ species: `Mon${i}`, fainted: true })),
    trainerId: 'cynthia',
    mode: 'daily',
    finishedAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  };
}

describe('trainerToSets', () => {
  it('maps every trainer Pokémon to a complete Showdown set', () => {
    for (const trainer of TRAINERS) {
      const sets = trainerToSets(trainer, 100);
      expect(sets).toHaveLength(6);
      sets.forEach((set, i) => {
        const src = trainer.team[i];
        expect(set.species).toBe(src.species);
        expect(set.name).toBe(src.nickname ?? src.species);
        expect(set.level).toBe(100);
        expect(set.moves).toEqual(src.moves);
        expect(set.ability).toBe(src.ability);
        expect(set.item).toBe(src.item);
        expect(set.nature).toBe(src.nature);
        expect(Object.keys(set.evs).sort()).toEqual(['atk', 'def', 'hp', 'spa', 'spd', 'spe']);
        expect(Object.keys(set.ivs).sort()).toEqual(['atk', 'def', 'hp', 'spa', 'spd', 'spe']);
        for (const v of Object.values(set.ivs)) expect(v).toBeGreaterThanOrEqual(0);
        if (!src.ivs) for (const v of Object.values(set.ivs)) expect(v).toBe(31);
        const evTotal = Object.values(set.evs).reduce((a, b) => a + b, 0);
        expect(evTotal).toBeLessThanOrEqual(510);
      });
    }
    expect(trainerToSets(TRAINERS[0], 50)[0].level).toBe(50);
  });

  it('fills partial EV/IV tables with defaults and clamps', () => {
    expect(fillEvs({ atk: 252, spe: 300 })).toEqual({ hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 });
    expect(fillIvs({ atk: 0 })).toEqual({ hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(fillIvs(undefined)).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
  });

  it('produces teams the Showdown engine accepts and can play 5 legal turns with', async () => {
    const { Battle, PRNG } = await import('@pkmn/sim');
    const prng = new PRNG('1,2,3,4' as PRNGSeed);
    const levels = [100, 50] as const;
    // Pair each trainer with the next one so every team is used both as p1 and p2.
    for (let i = 0; i < TRAINERS.length; i++) {
      const a = TRAINERS[i];
      const b = TRAINERS[(i + 1) % TRAINERS.length];
      const level = levels[i % 2];
      const battle = new Battle({ formatid: DEFAULT_FORMAT as never, seed: '1,2,3,4' as PRNGSeed, send() {} });
      battle.setPlayer('p1', { name: a.name, team: trainerToSets(a, level) });
      battle.setPlayer('p2', { name: b.name === a.name ? `${b.name} 2` : b.name, team: trainerToSets(b, level) });
      expect(battle.started, `${a.id} vs ${b.id} should start`).toBe(true);
      expect(battle.p1.pokemon).toHaveLength(6);
      expect(battle.p2.pokemon).toHaveLength(6);
      for (const side of [battle.p1, battle.p2]) {
        for (const mon of side.pokemon) {
          expect(mon.species.exists, `${side.name}: ${mon.set.species} should exist`).toBe(true);
          expect(mon.moveSlots.length, `${side.name}: ${mon.set.species} should have 4 moves`).toBe(4);
          expect(mon.maxhp).toBeGreaterThan(0);
        }
      }
      let turnsPlayed = 0;
      for (let turn = 0; turn < 5 && !battle.ended; turn++) {
        for (const side of [battle.p1, battle.p2]) {
          const req = side.activeRequest;
          if (!req || req.wait) continue;
          const choices = listLegalChoices(req);
          expect(choices.length, `${side.name} should have a legal choice`).toBeGreaterThan(0);
          // Shuffle so the turn is random; fall back through the list when the engine refuses a choice
          // (e.g. a switch while `maybeTrapped` by Shadow Tag — the request can't tell in advance).
          const shuffled = [...choices];
          prng.shuffle(shuffled);
          const accepted = shuffled.find((choice) => battle.choose(side.id, choice));
          expect(accepted, `${side.name}: none of ${JSON.stringify(choices)} accepted: ${side.choice.error}`).toBeDefined();
        }
        turnsPlayed++;
      }
      expect(turnsPlayed).toBeGreaterThan(0);
      expect(battle.turn).toBeGreaterThanOrEqual(1);
    }
  }, 120_000);
});

describe('Gen 9 only format: no Mega Stones / Z-Crystals', () => {
  it('knows every Mega Stone and Z-Crystal of the gen 9 dex', async () => {
    const { Dex } = await import('@pkmn/dex');
    const items = Dex.forGen(9).items.all();
    expect(items.filter((i) => i.megaStone).map((i) => i.id).sort()).toEqual([...MEGA_STONE_IDS].sort());
    expect(items.filter((i) => i.zMove).map((i) => i.id).sort()).toEqual([...Z_CRYSTAL_IDS].sort());
    expect(isGimmickItem('Charizardite X')).toBe(true);
    expect(isGimmickItem('Eviolite')).toBe(false);
    expect(isGimmickItem('Red Orb')).toBe(true);
    expect(isGimmickItem('')).toBe(false);
    expect(GIMMICK_ITEM_IDS.has('leftovers')).toBe(false);
  });

  it('isGen9OnlyFormat recognises the format with or without custom rules', () => {
    expect(isGen9OnlyFormat(GEN9_ONLY_FORMAT)).toBe(true);
    expect(isGen9OnlyFormat('gen9anythinggoes')).toBe(true);
    expect(isGen9OnlyFormat(DEFAULT_FORMAT)).toBe(false);
    expect(isGen9OnlyFormat(undefined)).toBe(false);
  });

  it('strips gimmick items from trainer sets only in that format, replacing them by role', () => {
    const red = getTrainer('red')!;
    const natdex = trainerToSets(red, 100);
    const gen9 = trainerToSets(red, 100, { formatid: GEN9_ONLY_FORMAT });
    const stoneIdx = natdex.findIndex((s) => isGimmickItem(s.item));
    expect(stoneIdx).toBeGreaterThanOrEqual(0);
    expect(gen9.every((s) => !isGimmickItem(s.item))).toBe(true);
    expect(['Life Orb', 'Leftovers']).toContain(gen9[stoneIdx].item);
    expect(gen9[stoneIdx].item).toBe(replacementItem(natdex[stoneIdx]));
    // Everything else is untouched.
    gen9.forEach((s, i) => {
      if (i !== stoneIdx) expect(s.item).toBe(natdex[i].item);
      expect(s.moves).toEqual(natdex[i].moves);
    });
    for (const t of TRAINERS) expect(trainerToSets(t, 50, { formatid: GEN9_ONLY_FORMAT }).some((s) => isGimmickItem(s.item))).toBe(false);
    expect(replacementItem({ evs: { hp: 252, def: 252, atk: 0, spa: 0, spd: 4, spe: 0 } })).toBe('Leftovers');
    expect(replacementItem({ evs: { hp: 0, def: 0, atk: 0, spa: 252, spd: 4, spe: 252 } })).toBe('Life Orb');
    const original = [{ ...natdex[stoneIdx] }];
    stripGimmickItems(original);
    expect(original[0].item).toBe(natdex[stoneIdx].item);
  });

  it('buildBattleSetup strips both teams in the Gen 9 only format and the sim no longer offers Mega Evolution', async () => {
    const red = getTrainer('red')!;
    const player = trainerToSets(getTrainer('steven')!, 100); // carries Metagrossite
    const gen9 = buildBattleSetup({ mode: 'custom', saveKey: null, trainer: red, playerName: 'Ash', playerTeam: player, level: 100, seed: '1,2,3,4', formatid: GEN9_ONLY_FORMAT });
    expect(gen9.config.player.team.some((s) => isGimmickItem(s.item))).toBe(false);
    expect(gen9.config.opponent.team.some((s) => isGimmickItem(s.item))).toBe(false);
    const natdex = buildBattleSetup({ mode: 'custom', saveKey: null, trainer: red, playerName: 'Ash', playerTeam: player, level: 100, seed: '1,2,3,4' });
    expect(natdex.config.player.team.some((s) => isGimmickItem(s.item))).toBe(true);
    expect(natdex.config.opponent.team.some((s) => isGimmickItem(s.item))).toBe(true);

    const { Battle } = await import('@pkmn/sim');
    const battle = new Battle({ formatid: GEN9_ONLY_FORMAT as never, seed: '1,2,3,4' as PRNGSeed, send() {} });
    battle.setPlayer('p1', { name: 'Ash', team: gen9.config.player.team });
    battle.setPlayer('p2', { name: 'Red', team: gen9.config.opponent.team });
    for (const side of [battle.p1, battle.p2]) {
      for (const mon of side.pokemon) expect(mon.canMegaEvo, `${mon.set.species} should not be able to Mega Evolve`).toBeFalsy();
    }
  });
});

describe('forfeitResult', () => {
  it('is a forfeit loss that lists both teams as sent out', () => {
    const r = forfeitResult({
      mode: 'daily', trainerId: 'cynthia', playerTeam: [{ species: 'Garchomp' }, { species: 'Lucario' }], opponentTeam: [{ species: 'Spiritomb' }], turns: 3, finishedAt: '2026-10-24T00:00:00.000Z',
    });
    expect(r).toMatchObject({ won: false, forfeited: true, turns: 3, playerRemaining: 2, opponentRemaining: 1, trainerId: 'cynthia', mode: 'daily', finishedAt: '2026-10-24T00:00:00.000Z' });
    expect(r.playerTeamStatus).toEqual([{ species: 'Garchomp', fainted: false }, { species: 'Lucario', fainted: false }]);
    expect(outcomeLabel(r)).toBe('FORFEIT');
    expect(Number.isNaN(Date.parse(forfeitResult({ mode: 'free', playerTeam: [], opponentTeam: [] }).finishedAt))).toBe(false);
  });

  it('forfeitResultFromSave counts the player actions in the input log', () => {
    const cynthia = getTrainer('cynthia')!;
    const setup = buildBattleSetup({ mode: 'boss-rush', saveKey: 'bossrush', trainer: cynthia, playerName: 'Ash', playerTeam: trainerToSets(getTrainer('red')!, 100), level: 100, seed: '1,2,3,4' });
    const r = forfeitResultFromSave({
      setup,
      serialized: { version: 1, config: setup.config, inputLog: ['>start', '>player p1', '>player p2', '>p1 move 1', '>p2 move 2', '>p1 switch 3'] },
      savedAt: '2026-10-24T00:00:00.000Z',
    });
    expect(r.turns).toBe(2);
    expect(r.mode).toBe('boss-rush');
    expect(r.trainerId).toBe('cynthia');
    expect(r.playerTeamStatus).toHaveLength(6);
    expect(r.opponentTeamStatus.map((p) => p.species)).toEqual(cynthia.team.map((p) => p.species));
  });
});

describe('difficultyFor', () => {
  it('uses the trainer rating unless overridden', () => {
    const cynthia = getTrainer('cynthia')!;
    expect(difficultyFor(cynthia)).toBe('champion');
    expect(difficultyFor(cynthia, 'trainer')).toBe('champion');
    expect(difficultyFor(cynthia, null)).toBe('champion');
    expect(difficultyFor(cynthia, 'normal')).toBe('normal');
    expect(difficultyFor(cynthia, 'hard')).toBe('hard');
    const oak = getTrainer('oak')!;
    expect(difficultyFor(oak)).toBe(oak.ai);
  });
});

describe('buildBattleSetup', () => {
  it('builds a complete setup with the trainer as the opponent', () => {
    const cynthia = getTrainer('cynthia')!;
    const sets = trainerToSets(getTrainer('red')!, 100);
    const setup = buildBattleSetup({
      mode: 'free',
      saveKey: 'free',
      trainer: cynthia,
      playerName: '  ',
      playerTeam: sets,
      level: 50,
      difficulty: 'normal',
      seed: '1,2,3,4',
    });
    expect(setup.mode).toBe('free');
    expect(setup.saveKey).toBe('free');
    expect(setup.trainerId).toBe('cynthia');
    expect(setup.config.seed).toBe('1,2,3,4');
    expect(setup.config.formatid).toBe(DEFAULT_FORMAT);
    expect(setup.config.player.name).toBe('Player');
    expect(setup.config.player.team.every((s) => s.level === 50)).toBe(true);
    expect(setup.config.opponent.name).toBe('Cynthia');
    expect(setup.config.opponent.avatar).toBe('cynthia');
    expect(setup.config.opponent.difficulty).toBe('normal');
    expect(setup.config.opponent.trainerId).toBe('cynthia');
    expect(setup.config.opponent.team.map((s) => s.species)).toEqual(cynthia.team.map((p) => p.species));
    expect(setup.config.opponent.team.every((s) => s.level === 50)).toBe(true);
    const random = buildBattleSetup({ mode: 'custom', saveKey: null, trainer: cynthia, playerName: 'Ash', playerTeam: sets, level: 100 });
    expect(random.config.seed).toMatch(/^\d+,\d+,\d+,\d+$/);
    expect(random.config.opponent.difficulty).toBe('champion');
  });
});

describe('results helpers', () => {
  it('counts remaining Pokémon from the team status', () => {
    expect(remainingCounts(makeResult())).toEqual({ player: 4, playerTotal: 6, opponent: 0, opponentTotal: 6 });
    expect(remainingCounts(makeResult({ playerTeamStatus: [], opponentTeamStatus: [], playerRemaining: 2, opponentRemaining: 1 }))).toEqual({
      player: 2,
      playerTotal: 6,
      opponent: 1,
      opponentTotal: 6,
    });
  });
  it('labels outcomes and win rates', () => {
    expect(outcomeLabel(makeResult())).toBe('WIN');
    expect(outcomeLabel(makeResult({ won: false }))).toBe('LOSS');
    expect(outcomeLabel(makeResult({ won: false, forfeited: true }))).toBe('FORFEIT');
    expect(winPercent(2, 3)).toBe(66.7);
    expect(winPercent(0, 0)).toBe(0);
  });
});

describe('buildShareText', () => {
  it('matches the share format', () => {
    const text = buildShareText({ date: '2026-10-21', trainerName: 'Champion Cynthia', result: makeResult(), streak: 3 });
    expect(text).toBe('Pokémon Champions — 2026-10-21\nvs Champion Cynthia — WIN in 14 turns\n🟢🟢🔴🟢🔴🟢\nStreak: 3');
    expect(text).toMatchSnapshot();
  });
  it('handles losses, single turns and missing team status', () => {
    const loss = buildShareText({
      date: '2026-01-01',
      trainerName: 'Professor Oak',
      result: makeResult({ won: false, turns: 1, playerTeamStatus: [], playerRemaining: 0 }),
      streak: 0,
    });
    expect(loss).toBe('Pokémon Champions — 2026-01-01\nvs Professor Oak — LOSS in 1 turn\n🔴🔴🔴🔴🔴🔴\nStreak: 0');
    expect(resultEmojiGrid(makeResult({ playerTeamStatus: [], playerRemaining: 6 }))).toBe('🟢🟢🟢🟢🟢🟢');
  });
});

describe('boss rush', () => {
  it('orders trainers by ascending difficulty, ties by name', () => {
    const order = bossRushOrder();
    expect(order).toHaveLength(TRAINERS.length);
    for (let i = 1; i < order.length; i++) {
      const prev = order[i - 1];
      const cur = order[i];
      expect(prev.difficulty).toBeLessThanOrEqual(cur.difficulty);
      if (prev.difficulty === cur.difficulty) expect(prev.name.localeCompare(cur.name)).toBeLessThanOrEqual(0);
    }
    expect(new Set(order.map((t) => t.id)).size).toBe(TRAINERS.length);
  });

  it('starts a run over the full order', () => {
    const run = startRun(false, undefined, new Date('2026-10-21T00:00:00Z'));
    expect(run.status).toBe('active');
    expect(run.index).toBe(0);
    expect(run.defeated).toBe(0);
    expect(run.keepTeam).toBe(false);
    expect(run.team).toBeNull();
    expect(run.startedAt).toBe('2026-10-21T00:00:00.000Z');
    expect(run.order).toEqual(bossRushOrder().map((t) => t.id));
    expect(totalStages(run)).toBe(TRAINERS.length);
    expect(currentTrainer(run)?.id).toBe(run.order[0]);
    expect(stageTeamSeed(run)).toBe('bossrush-2026-10-21T00:00:00.000Z-0');
    expect(isValidRun(run)).toBe(true);
    expect(isValidRun({})).toBe(false);
    expect(isValidRun(null)).toBe(false);

    const sets = trainerToSets(getTrainer('red')!, 100);
    const kept = startRun(true, sets);
    expect(kept.keepTeam).toBe(true);
    expect(kept.team?.map((s) => s.species)).toEqual(sets.map((s) => s.species));
    expect(withTeam(startRun(true), sets).team).toHaveLength(6);
  });

  it('advances through every stage and finishes after the last win', () => {
    let run = startRun(false);
    const total = totalStages(run);
    for (let i = 0; i < total; i++) {
      expect(run.status).toBe('active');
      expect(currentTrainer(run)?.id).toBe(run.order[i]);
      expect(isComplete(run)).toBe(false);
      run = advance(run);
      expect(run.defeated).toBe(i + 1);
    }
    expect(run.status).toBe('finished');
    expect(isComplete(run)).toBe(true);
    expect(currentTrainer(run)).toBeNull();
    // advancing a finished run is a no-op
    expect(advance(run)).toBe(run);
  });

  it('finish keeps the defeated count and never changes the order', () => {
    let run = startRun(true, trainerToSets(getTrainer('red')!, 100));
    run = advance(advance(run));
    const done = finish(run);
    expect(done.status).toBe('finished');
    expect(done.defeated).toBe(2);
    expect(done.index).toBe(2);
    expect(done.order).toEqual(run.order);
    expect(done.team).toBe(run.team);
    expect(finish(done)).toBe(done);
    expect(currentTrainer(done)).toBeNull();
  });
});
