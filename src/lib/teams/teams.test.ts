import { describe, it, expect, beforeAll } from 'vitest';
import type { PokemonSet, ID } from '@pkmn/sim';
import { generateTeam, toSets, reorderLead, getSpeciesPool, describeRole, summarizeSet, settingsKey, DEFAULT_TEAM_SETTINGS } from './index';
import type { GeneratedTeam, TeamGenSettings, GenerationMode } from './types';
import { getDex, fullLearnset, legendaryClass, type ModdedDex } from '@/lib/data/dex';
import { listLegalChoices } from '@/lib/battle/legal';
import { toId } from './pool';

const MODES: GenerationMode[] = ['balanced', 'competitive', 'random', 'chaos'];
let dex: ModdedDex;

beforeAll(async () => {
  dex = await getDex();
  // Warm up dex / learnsets / generators so timing assertions measure steady state.
  await generateTeam(DEFAULT_TEAM_SETTINGS, 'warmup');
});

function speciesNames(team: GeneratedTeam): string[] {
  return team.pokemon.map((p) => p.set.species).sort();
}

describe('generateTeam', () => {
  it('is deterministic for the same settings and seed, and varies with the seed', async () => {
    const a = await generateTeam(DEFAULT_TEAM_SETTINGS, 'seed-1');
    const b = await generateTeam(DEFAULT_TEAM_SETTINGS, 'seed-1');
    expect(toSets(a)).toEqual(toSets(b));
    expect(a.pokemon.map((p) => p.source)).toEqual(b.pokemon.map((p) => p.source));
    const c = await generateTeam(DEFAULT_TEAM_SETTINGS, 'seed-2');
    expect(speciesNames(c)).not.toEqual(speciesNames(a));
    // Different modes with the same seed are also independent streams.
    const d = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, mode: 'random' }, 'seed-1');
    expect(speciesNames(d)).not.toEqual(speciesNames(a));
    // Overlapping calls (a quick reroll) must not disturb each other's random streams.
    const [x, y, z] = await Promise.all([
      generateTeam(DEFAULT_TEAM_SETTINGS, 'seed-1'),
      generateTeam({ ...DEFAULT_TEAM_SETTINGS, mode: 'random' }, 'seed-1'),
      generateTeam(DEFAULT_TEAM_SETTINGS, 'seed-2'),
    ]);
    expect(toSets(x)).toEqual(toSets(a));
    expect(toSets(y)).toEqual(toSets(d));
    expect(toSets(z)).toEqual(toSets(c));
  });

  it('respects the default settings', async () => {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
      const team = await generateTeam(DEFAULT_TEAM_SETTINGS, seed);
      expect(team.pokemon).toHaveLength(6);
      const bases = new Set(team.pokemon.map((p) => dex.species.get(p.speciesId).baseSpecies));
      expect(bases.size).toBe(6);
      for (const p of team.pokemon) {
        const species = dex.species.get(p.speciesId);
        expect(species.exists).toBe(true);
        expect(DEFAULT_TEAM_SETTINGS.gens).toContain(species.gen);
        expect(p.gen).toBe(species.gen);
        expect(['restricted', 'mythical']).not.toContain(legendaryClass(species));
        expect(p.set.level).toBe(100);
        expect(p.set.moves).toHaveLength(4);
        expect(new Set(p.set.moves.map(toId)).size).toBe(4);
        expect(p.set.species).toBe(species.name);
        expect(p.role).toBeTruthy();
        expect(p.source).toMatch(/^(gen[3-9]|fallback|chaos)$/);
      }
    }
  });

  it('honours generation, legendary and level settings', async () => {
    const gen1 = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, gens: [1] }, 'g1');
    for (const p of gen1.pokemon) {
      const s = dex.species.get(p.speciesId);
      expect(s.gen).toBe(1);
      expect(s.forme).toBe('');
      expect(s.num).toBeLessThanOrEqual(151);
    }
    for (const seed of ['n1', 'n2', 'n3']) {
      const none = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, legendaries: 'none', mode: 'random' }, seed);
      for (const p of none.pokemon) expect(legendaryClass(dex.species.get(p.speciesId))).toBe('none');
    }
    const fifty = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, level: 50 }, 'l50');
    for (const p of fifty.pokemon) expect(p.set.level).toBe(50);
    const all = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, legendaries: 'all', mode: 'competitive' }, 'all');
    expect(all.pokemon).toHaveLength(6);
  });

  it('produces teams in all four modes, with NFEs in random and chaos', async () => {
    for (const mode of MODES) {
      const team = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, mode }, `mode-${mode}`);
      expect(team.pokemon).toHaveLength(6);
      expect(team.settings.mode).toBe(mode);
      if (mode === 'chaos') for (const p of team.pokemon) expect(p.source).toBe('chaos');
      else for (const p of team.pokemon) expect(p.source).not.toBe('chaos');
    }
    for (const mode of ['random', 'chaos'] as const) {
      let nfe = 0;
      for (let i = 0; i < 20; i++) {
        const team = await generateTeam({ ...DEFAULT_TEAM_SETTINGS, mode }, `nfe-${mode}-${i}`);
        nfe += team.pokemon.filter((p) => dex.species.get(p.speciesId).nfe).length;
      }
      expect(nfe).toBeGreaterThan(0);
    }
    // Balanced teams keep type stacking in check (≤ 2 sharing a type) in the common case.
    const balanced = await generateTeam(DEFAULT_TEAM_SETTINGS, 'types');
    const typeCount = new Map<string, number>();
    for (const p of balanced.pokemon) for (const t of dex.species.get(p.speciesId).types) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    for (const n of typeCount.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it('generates valid sets that the engine accepts (30 seeds, mixed modes)', async () => {
    const { Battle } = await import('@pkmn/sim');
    const teams: { team: GeneratedTeam; ms: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const settings: TeamGenSettings = {
        ...DEFAULT_TEAM_SETTINGS,
        mode: MODES[i % MODES.length],
        legendaries: i % 3 === 0 ? 'all' : i % 3 === 1 ? 'no-restricted' : 'none',
        gens: i % 5 === 0 ? [1, 2, 3] : i % 5 === 1 ? [7, 8, 9] : DEFAULT_TEAM_SETTINGS.gens,
        level: i % 2 ? 50 : 100,
      };
      const t0 = performance.now();
      const team = await generateTeam(settings, `valid-${i}`);
      teams.push({ team, ms: performance.now() - t0 });
      for (const p of team.pokemon) {
        const species = dex.species.get(p.speciesId);
        const learnset = await fullLearnset(dex, species.id);
        expect(p.set.moves).toHaveLength(4);
        if (p.source !== 'chaos') expect(p.set.moves.map(toId), `${species.name} carries Tera Blast`).not.toContain('terablast');
        for (const name of p.set.moves) {
          const move = dex.moves.get(name);
          expect(move.exists, `${species.name} move ${name}`).toBe(true);
          const learnable = learnset.has(move.id) || (move.id.startsWith('hiddenpower') && learnset.has('hiddenpower'));
          expect(learnable, `${species.name} cannot learn ${name}`).toBe(true);
        }
        const abilities = Object.values(species.abilities).filter(Boolean).map(toId);
        expect(abilities, `${species.name} ability ${p.set.ability}`).toContain(toId(p.set.ability));
        expect(dex.items.get(p.set.item).exists || p.set.item === '', `${species.name} item ${p.set.item}`).toBe(true);
        if (species.requiredItem) expect(p.set.item).toBe(species.requiredItem);
        const evs = Object.values(p.set.evs);
        expect(evs.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510);
        for (const v of evs) expect(v).toBeLessThanOrEqual(252);
        expect(dex.natures.get(p.set.nature).exists).toBe(true);
        expect(p.set.level).toBe(settings.level);
      }
    }
    // Engine acceptance: pair teams up and play 5 turns of random legal choices.
    const { PRNG } = await import('@pkmn/sim');
    const prng = new PRNG('9,8,7,6');
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const p1 = toSets(teams[i].team);
      const p2 = toSets(teams[i + 1].team);
      const battle = new Battle({ formatid: 'gen9nationaldex@@@!Team Preview' as ID, seed: '1,2,3,4', send() {} });
      battle.setPlayer('p1', { name: 'A', team: p1 });
      battle.setPlayer('p2', { name: 'B', team: p2 });
      expect(battle.turn).toBe(1);
      let guard = 0;
      while (!battle.ended && battle.turn <= 5 && guard++ < 40) {
        for (const side of [battle.p1, battle.p2]) {
          const req = side.activeRequest;
          if (!req || 'wait' in req) continue;
          const choices = listLegalChoices(req);
          expect(choices.length).toBeGreaterThan(0);
          let choice = prng.sample(choices);
          let ok = battle.choose(side.id, choice);
          // Showdown reports uncertain trapping (Shadow Tag / Arena Trap) as `maybeTrapped`, which the
          // choice enumerator cannot see; fall back to a move when a switch is refused for that reason.
          if (!ok && choice.startsWith('switch') && /trapped/i.test(side.choice.error)) {
            choice = choices.find((c) => c.startsWith('move')) ?? choice;
            ok = battle.choose(side.id, choice);
          }
          expect(ok, `${side.id} ${choice}: ${side.choice.error}`).toBe(true);
        }
      }
      expect(battle.turn).toBeGreaterThanOrEqual(2);
    }
    const times = teams.map((t) => t.ms);
    console.log(`team generation ms: ${times.map((t) => t.toFixed(1)).join(', ')} (max ${Math.max(...times).toFixed(1)})`);
    for (const ms of times) expect(ms).toBeLessThan(2000);
  });

  it('exposes helpers (pool, reorderLead, describeRole, summarizeSet, settingsKey)', async () => {
    const pool = await getSpeciesPool(DEFAULT_TEAM_SETTINGS);
    expect(pool.length).toBeGreaterThan(900);
    expect(pool.some((s) => s.name === 'Ditto')).toBe(false); // cannot have four moves
    expect(pool.some((s) => s.name === 'Rotom-Wash')).toBe(true);
    expect(pool.some((s) => s.name === 'Charizard-Mega-X')).toBe(false);
    expect(pool.some((s) => s.name === 'Unown-B')).toBe(false);
    expect(await getSpeciesPool(DEFAULT_TEAM_SETTINGS)).toBe(pool); // memoized
    expect(settingsKey({ ...DEFAULT_TEAM_SETTINGS, gens: [9, 1] })).toBe(settingsKey({ ...DEFAULT_TEAM_SETTINGS, gens: [1, 9] }));

    const team = await generateTeam(DEFAULT_TEAM_SETTINGS, 'helpers');
    const sets: PokemonSet[] = toSets(team);
    const reordered = reorderLead(sets, 3);
    expect(reordered[0]).toBe(sets[3]);
    expect(reordered).toHaveLength(6);
    expect(new Set(reordered)).toEqual(new Set(sets));
    expect(reorderLead(sets, 0)).toEqual(sets);
    for (const p of team.pokemon) {
      expect(describeRole(p)).toBeTruthy();
      expect(describeRole(p.set)).toBeTruthy();
      expect(summarizeSet(p)).toContain(p.set.species);
      expect(summarizeSet(p.set)).toContain(p.set.moves[0]);
    }
  });
});
