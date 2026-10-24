import { describe, expect, it } from 'vitest';
import type { PokemonSet } from '@pkmn/sim';
import { ProtocolContext, parseProtocolLines, normalizeIdent, cleanText } from './protocol';
import { createBattleSession } from './session';
import type { BattleConfig, BattleEvent } from './types';

const BASE: Omit<PokemonSet, 'name' | 'species' | 'moves' | 'ability' | 'gender'> = {
  item: '',
  nature: 'Hardy',
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  level: 100,
};

function byKind<K extends BattleEvent['kind']>(events: BattleEvent[], kind: K): Extract<BattleEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<BattleEvent, { kind: K }> => e.kind === kind);
}

const INTRO = [
  '|t:|1700000000',
  '|gametype|singles',
  '|player|p1|Red||',
  '|player|p2|Cynthia||',
  '|gen|9',
  '|tier|[Gen 9] National Dex',
  '|rule|Sleep Clause Mod: Limit one foe put to sleep',
  '|raw|<div class="infobox">custom rule</div>',
  '|',
  '|teamsize|p1|2',
  '|teamsize|p2|2',
  '|start',
  '|split|p1',
  '|switch|p1a: Garchomp|Garchomp, M|357/357',
  '|switch|p1a: Garchomp|Garchomp, M|100/100',
  '|split|p2',
  '|switch|p2a: Spiritomb|Spiritomb, F|281/281',
  '|switch|p2a: Spiritomb|Spiritomb, F|100/100',
  '|turn|1',
];

describe('parseProtocolLines', () => {
  async function context(resolveMaxHp?: (side: 'p1' | 'p2', ident: string) => number | undefined) {
    return ProtocolContext.create({ names: { p1: 'Red', p2: 'Cynthia' }, resolveMaxHp });
  }

  it('drops bookkeeping lines and keeps the secret half of |split| pairs', async () => {
    const ctx = await context();
    const events = parseProtocolLines(INTRO, ctx);
    expect(events.map((e) => e.kind)).toEqual(['switch', 'switch', 'turn']);
    const [p1, p2] = byKind(events, 'switch');
    expect(p1).toMatchObject({ side: 'p1', ident: 'p1: Garchomp', species: 'Garchomp', level: 100, gender: 'M', shiny: false, hp: 357, maxhp: 357, status: '', drag: false });
    expect(p1.text).toBe('Go! Garchomp!');
    expect(p2).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb', species: 'Spiritomb', gender: 'F', hp: 281, maxhp: 281 });
    expect(p2.text).toBe('Cynthia sent out Spiritomb!');
    expect(byKind(events, 'turn')[0]).toEqual({ kind: 'turn', turn: 1, text: '' });
    for (const e of events) expect(e.text).not.toContain('**');
  });

  it('maps moves, damage, heals, status, boosts, effectiveness, faints and the winner', async () => {
    const ctx = await context((_side, ident) => (ident === 'p2: Spiritomb' ? 281 : undefined));
    ctx.feed(INTRO);
    const events = parseProtocolLines([
      '|',
      '|move|p2a: Spiritomb|Will-O-Wisp|p1a: Garchomp',
      '|split|p1',
      '|-status|p1a: Garchomp|brn',
      '|-status|p1a: Garchomp|brn',
      '|move|p1a: Garchomp|Earthquake|p2a: Spiritomb',
      '|-supereffective|p2a: Spiritomb',
      '|-crit|p2a: Spiritomb',
      '|split|p2',
      '|-damage|p2a: Spiritomb|40/281',
      '|-damage|p2a: Spiritomb|15/100',
      '|-unboost|p2a: Spiritomb|def|1',
      '|',
      '|split|p1',
      '|-heal|p1a: Garchomp|357/357|[from] item: Leftovers',
      '|-heal|p1a: Garchomp|100/100|[from] item: Leftovers',
      '|split|p1',
      '|-damage|p1a: Garchomp|335/357 brn|[from] brn',
      '|-damage|p1a: Garchomp|94/100 brn|[from] brn',
      '|upkeep',
      '|turn|2',
      '|',
      '|move|p1a: Garchomp|Earthquake|p2a: Spiritomb',
      '|split|p2',
      '|-damage|p2a: Spiritomb|0 fnt',
      '|-damage|p2a: Spiritomb|0 fnt',
      '|faint|p2a: Spiritomb',
      '|',
      '|win|Red',
    ], ctx);

    expect(events.map((e) => e.kind)).toEqual([
      'move', 'status', 'move', 'effectiveness', 'crit', 'damage', 'boost', 'heal', 'damage', 'turn',
      'move', 'damage', 'faint', 'win',
    ]);
    const moves = byKind(events, 'move');
    expect(moves[0]).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb', move: 'Will-O-Wisp', target: 'p1: Garchomp' });
    expect(moves[0].text).toBe('The opposing Spiritomb used Will-O-Wisp!');
    expect(moves[1].text).toBe('Garchomp used Earthquake!');

    expect(byKind(events, 'status')[0]).toMatchObject({ side: 'p1', ident: 'p1: Garchomp', status: 'brn' });
    expect(byKind(events, 'status')[0].text).toBe('Garchomp was burned!');
    expect(byKind(events, 'effectiveness')[0]).toMatchObject({ side: 'p2', effectiveness: 'super', text: "It's super effective!" });
    expect(byKind(events, 'crit')[0].text).toBe('A critical hit!');
    expect(byKind(events, 'boost')[0]).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb', stat: 'def', amount: -1 });
    expect(byKind(events, 'boost')[0].text).toBe("The opposing Spiritomb's Defense fell!");

    const damages = byKind(events, 'damage');
    // Secret line kept, public (percentage) line dropped.
    expect(damages[0]).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb', hp: 40, maxhp: 281, status: '', text: '' });
    expect(damages[0].from).toBeUndefined();
    expect(damages[1]).toMatchObject({ side: 'p1', ident: 'p1: Garchomp', hp: 335, maxhp: 357, status: 'brn', from: 'brn' });
    expect(damages[1].text).toBe('Garchomp was hurt by its burn!');
    // "0 fnt" carries no max HP: resolved through the context callback.
    expect(damages[2]).toMatchObject({ side: 'p2', hp: 0, maxhp: 281, text: '' });
    expect(events.some((e) => e.kind === 'damage' && e.maxhp === 100)).toBe(false);

    const heal = byKind(events, 'heal')[0];
    expect(heal).toMatchObject({ side: 'p1', hp: 357, maxhp: 357, from: 'item: Leftovers' });
    expect(heal.text).toBe('Garchomp restored a little HP using its Leftovers!');

    expect(byKind(events, 'faint')[0]).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb', text: 'The opposing Spiritomb fainted!' });
    expect(byKind(events, 'win')[0]).toEqual({ kind: 'win', winner: 'p1', text: 'Red won the battle!' });
    for (const e of events) {
      expect(e.text).not.toContain('**');
      expect(e.text).not.toMatch(/lost .*% of its health/);
    }
  });

  it('maps field, side, weather, items, abilities, forme changes and unknown lines', async () => {
    const ctx = await context();
    ctx.feed(INTRO);
    const events = parseProtocolLines([
      '|-weather|RainDance',
      '|-weather|RainDance|[upkeep]',
      '|-weather|none',
      '|-fieldstart|move: Electric Terrain',
      '|-fieldend|move: Electric Terrain',
      '|-sidestart|p2: Cynthia|move: Stealth Rock',
      '|-sideend|p1: Red|Reflect',
      '|-item|p1a: Garchomp|Leftovers',
      '|-enditem|p1a: Garchomp|Leftovers|[eat]',
      '|-ability|p2a: Spiritomb|Pressure',
      '|-activate|p1a: Garchomp|move: Protect',
      '|-activate|p2a: Spiritomb|ability: Pressure',
      '|-singleturn|p1a: Garchomp|Protect',
      '|-start|p1a: Garchomp|confusion',
      '|-end|p1a: Garchomp|confusion',
      '|detailschange|p1a: Garchomp|Garchomp-Mega, M',
      '|-mega|p1a: Garchomp|Garchomp|Garchompite',
      '|-formechange|p2a: Spiritomb|Spiritomb',
      '|-terastallize|p1a: Garchomp|Fire',
      '|-zpower|p1a: Garchomp',
      '|-miss|p1a: Garchomp|p2a: Spiritomb',
      '|-fail|p1a: Garchomp',
      '|-immune|p2a: Spiritomb',
      '|-resisted|p2a: Spiritomb',
      '|cant|p2a: Spiritomb|par',
      '|-clearboost|p1a: Garchomp',
      '|-sethp|p2a: Spiritomb|140/281',
      '|-curestatus|p1a: Garchomp|brn',
      '|-hint|Nothing to see here',
      '|-bogus-command|p1a: Garchomp',
      '|request|{}',
      '|tie',
    ], ctx);
    const kinds = events.map((e) => e.kind);
    expect(kinds).toEqual([
      'weather', 'weather', 'weather', 'field', 'field', 'side', 'side', 'item', 'enditem', 'ability', 'activate',
      'activate', 'start', 'start', 'end', 'formechange', 'mega', 'formechange', 'terastallize', 'zpower', 'miss', 'fail',
      'effectiveness', 'effectiveness', 'cant', 'clearboost', 'sethp', 'curestatus', 'message', 'win',
    ]);
    const weather = byKind(events, 'weather');
    expect(weather[0]).toMatchObject({ weather: 'RainDance', upkeep: false, text: 'It started to rain!' });
    expect(weather[1]).toMatchObject({ weather: 'RainDance', upkeep: true });
    expect(weather[2]).toMatchObject({ weather: '', upkeep: false });
    expect(byKind(events, 'field')[0]).toMatchObject({ effect: 'Electric Terrain', start: true });
    expect(byKind(events, 'field')[1]).toMatchObject({ effect: 'Electric Terrain', start: false });
    expect(byKind(events, 'side')[0]).toMatchObject({ side: 'p2', condition: 'Stealth Rock', start: true });
    expect(byKind(events, 'side')[0].text).toBe('Pointed stones float in the air around the opposing team!');
    expect(byKind(events, 'side')[1]).toMatchObject({ side: 'p1', condition: 'Reflect', start: false });
    expect(byKind(events, 'item')[0]).toMatchObject({ ident: 'p1: Garchomp', item: 'Leftovers' });
    expect(byKind(events, 'enditem')[0]).toMatchObject({ ident: 'p1: Garchomp', item: 'Leftovers' });
    expect(byKind(events, 'ability')[0]).toMatchObject({ ident: 'p2: Spiritomb', ability: 'Pressure' });
    expect(byKind(events, 'activate')[0]).toMatchObject({ ident: 'p1: Garchomp', effect: 'Protect' });
    expect(byKind(events, 'activate')[1]).toMatchObject({ ident: 'p2: Spiritomb', effect: 'Pressure' });
    expect(byKind(events, 'start')[0]).toMatchObject({ ident: 'p1: Garchomp', effect: 'Protect', text: 'Garchomp protected itself!' });
    expect(byKind(events, 'start')[1]).toMatchObject({ effect: 'confusion' });
    expect(byKind(events, 'formechange')[0]).toMatchObject({ ident: 'p1: Garchomp', species: 'Garchomp-Mega', permanent: true });
    expect(byKind(events, 'mega')[0]).toMatchObject({ ident: 'p1: Garchomp', species: 'Garchomp' });
    expect(byKind(events, 'mega')[0].text).toContain('Mega Evolved');
    expect(byKind(events, 'formechange')[1]).toMatchObject({ ident: 'p2: Spiritomb', permanent: false });
    expect(byKind(events, 'terastallize')[0]).toMatchObject({ type: 'Fire' });
    expect(byKind(events, 'miss')[0]).toMatchObject({ side: 'p2', ident: 'p2: Spiritomb' });
    expect(byKind(events, 'effectiveness').map((e) => e.effectiveness)).toEqual(['immune', 'resisted']);
    expect(byKind(events, 'cant')[0]).toMatchObject({ ident: 'p2: Spiritomb', reason: 'par' });
    expect(byKind(events, 'cant')[0].text).toBe('The opposing Spiritomb is paralyzed! It can\'t move!');
    expect(byKind(events, 'sethp')[0]).toMatchObject({ ident: 'p2: Spiritomb', hp: 140, maxhp: 281 });
    expect(byKind(events, 'curestatus')[0]).toMatchObject({ status: 'brn' });
    expect(byKind(events, 'message')[0].text).toBe('(Nothing to see here)');
    expect(byKind(events, 'win')[0]).toMatchObject({ winner: 'tie' });
  });

  it('normalizes idents and cleans text', () => {
    expect(normalizeIdent('p2a: Spiritomb')).toBe('p2: Spiritomb');
    expect(normalizeIdent('p1: Garchomp')).toBe('p1: Garchomp');
    expect(normalizeIdent('p1b: Mr. Mime')).toBe('p1: Mr. Mime');
    expect(cleanText('  Garchomp used **Earthquake**!  \n\n  It\'s super effective!  ')).toBe("Garchomp used Earthquake!\nIt's super effective!");
  });

  it('feed() updates the formatter context without emitting events', async () => {
    const ctx = await context();
    expect(ctx.feed(INTRO)).toBeUndefined();
    const events = parseProtocolLines(['|move|p1a: Garchomp|Earthquake|p2a: Spiritomb'], ctx);
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('Garchomp used Earthquake!');
  });
});

describe('live protocol events', () => {
  it('damage events carry the real max HP and texts are populated', async () => {
    const config: BattleConfig = {
      seed: '1,2,3,4',
      player: {
        name: 'Red',
        team: [{ ...BASE, name: 'Garchomp', species: 'Garchomp', ability: 'Rough Skin', moves: ['Frost Breath', 'Earthquake'], gender: 'M', evs: { ...BASE.evs, spa: 252, spe: 252 } }],
      },
      opponent: {
        name: 'Lance',
        difficulty: 'normal',
        team: [{ ...BASE, name: 'Dragonite', species: 'Dragonite', ability: 'Inner Focus', moves: ['Splash'], gender: 'M', evs: { ...BASE.evs, hp: 252 } }],
      },
    };
    const session = await createBattleSession(config);
    const intro = session.start();
    const p2Lead = byKind(intro.events, 'switch').find((e) => e.side === 'p2');
    expect(p2Lead?.maxhp).toBeGreaterThan(100);
    expect(p2Lead?.maxhp).toBe(intro.snapshot.sides.p2.pokemon[0].maxhp);

    const result = session.submit('move 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const damage = byKind(result.events, 'damage').find((e) => e.side === 'p2');
    expect(damage).toBeDefined();
    expect(damage!.maxhp).toBe(intro.snapshot.sides.p2.pokemon[0].maxhp);
    expect(damage!.maxhp).not.toBe(100);
    expect(damage!.hp).toBe(result.snapshot.sides.p2.pokemon[0].hp);
    expect(damage!.text).toBe('');

    const move = byKind(result.events, 'move').find((e) => e.side === 'p1');
    expect(move?.move).toBe('Frost Breath');
    expect(move?.text).toBe('Garchomp used Frost Breath!');
    expect(byKind(result.events, 'effectiveness')[0]).toMatchObject({ side: 'p2', effectiveness: 'super', text: "It's super effective!" });
    expect(byKind(result.events, 'crit')[0]).toMatchObject({ side: 'p2', text: 'A critical hit!' });
    const faint = byKind(result.events, 'faint')[0];
    if (faint) expect(faint.text.length).toBeGreaterThan(0);
    for (const e of result.events) {
      expect(e.text).not.toContain('**');
      expect(e.text).not.toMatch(/lost .*% of its health/);
    }
  });
});
