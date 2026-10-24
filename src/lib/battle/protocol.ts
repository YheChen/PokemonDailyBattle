/**
 * Protocol → BattleEvent translation.
 *
 * Takes the raw Showdown protocol lines emitted by the sim (`send('update', lines)`), resolves the
 * `|split|` secret/public pairs, feeds every line to a `@pkmn/client` Battle (the text formatter's
 * state tracker) and turns the lines the game cares about into typed `BattleEvent`s with ready-to-show
 * text from `@pkmn/view`'s `LogFormatter` (perspective p1).
 *
 * This module is React-free and works in Node and the browser. The heavy dependencies
 * (`@pkmn/dex`, `@pkmn/data`, `@pkmn/client`, `@pkmn/view`) are loaded with dynamic `import()`
 * inside `ProtocolContext.create`.
 */
import { Protocol } from '@pkmn/protocol';
import type { ArgType, KWArgType } from '@pkmn/protocol';
import type { Battle as ClientBattle } from '@pkmn/client';
import type { LogFormatter } from '@pkmn/view';
import type { BattleEvent, BoostID, GenderName, SideID, StatusName } from './types';

/**
 * Protocol commands that never become events. They are still fed to the client battle so the
 * formatter has the right context (player names, generation, tier…).
 * `done` is what `Protocol.parseBattleLine` returns for the empty `|` separator line.
 */
export const DROPPED_COMMANDS: ReadonlySet<string> = new Set([
  'request', 't:', 'j', 'l', 'c', 'raw', 'html', 'inactive', 'inactiveoff', 'debug', 'player', 'teamsize',
  'gametype', 'gen', 'tier', 'rule', 'clearpoke', 'poke', 'teampreview', 'upkeep', 'start', '', 'done',
  'seed', 'rated', 'init', 'title', 'chat', 'c:', 'n', 'uhtml', 'uhtmlchange', 'error', 'bigerror', 'deinit',
]);

const STATUS_NAMES: ReadonlySet<string> = new Set(['brn', 'par', 'slp', 'frz', 'psn', 'tox']);
const BOOST_IDS: ReadonlySet<string> = new Set(['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']);

/** "(Garchomp lost 12% of its health!)" style parentheticals that the game never shows. */
const HP_PARENTHETICAL = /^\(.*of its health!?\)$/;

export interface ProtocolContextOptions {
  /** Player names exactly as the sim knows them (used to map `|win|NAME` to a side). */
  names: { p1: string; p2: string };
  /**
   * Resolves the real max HP of a Pokémon when the protocol line does not carry it
   * (`|-damage|p2a: X|0 fnt`). `ident` is normalized ("p2: Spiritomb").
   */
  resolveMaxHp?: (side: SideID, ident: string) => number | undefined;
}

/** `"p2a: Spiritomb"` → `{ side: 'p2', ident: 'p2: Spiritomb', name: 'Spiritomb' }`. */
export function parseIdent(raw: string): { side: SideID; ident: string; name: string } {
  const { player, name } = Protocol.parsePokemonIdent(raw as Protocol.PokemonIdent);
  const side = (player === 'p2' ? 'p2' : 'p1') as SideID;
  return { side, ident: `${player}: ${name}`, name };
}

/** `"p2a: Spiritomb"` or `"p2: Spiritomb"` → `"p2: Spiritomb"`. */
export function normalizeIdent(raw: string): string {
  return parseIdent(raw).ident;
}

/** `"p1: Player"` (a `Protocol.Side` argument) → `'p1'`. */
function sideFromArg(raw: string): SideID {
  return raw.startsWith('p2') ? 'p2' : 'p1';
}

/** `"move: Stealth Rock"` → `"Stealth Rock"`, `"ability: Levitate"` → `"Levitate"`. */
function stripEffectPrefix(effect: string | undefined): string {
  if (!effect) return '';
  const idx = effect.indexOf(': ');
  return idx === -1 ? effect : effect.slice(idx + 2);
}

function toStatus(raw: string | undefined): StatusName {
  return raw && STATUS_NAMES.has(raw) ? (raw as StatusName) : '';
}

function toGender(raw: string | undefined): GenderName {
  return raw === 'M' || raw === 'F' ? raw : 'N';
}

/** Strips `**` markup and collapses whitespace line by line. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** Removes the "(X lost N% of its health!)" parenthetical the game never shows. */
function stripHpParenthetical(text: string): string {
  return text
    .split('\n')
    .filter((line) => !HP_PARENTHETICAL.test(line))
    .join('\n');
}

/**
 * Owns the `@pkmn/client` Battle (state tracker) and the `@pkmn/view` LogFormatter. One context
 * per battle session; it must see every protocol line in order.
 */
export class ProtocolContext {
  readonly names: { p1: string; p2: string };
  private readonly resolveMaxHp?: ProtocolContextOptions['resolveMaxHp'];

  constructor(
    readonly clientBattle: ClientBattle,
    readonly formatter: LogFormatter,
    opts: ProtocolContextOptions,
  ) {
    this.names = { ...opts.names };
    this.resolveMaxHp = opts.resolveMaxHp;
  }

  static async create(opts: ProtocolContextOptions): Promise<ProtocolContext> {
    const [{ Dex }, { Generations }, { Battle }, { LogFormatter }] = await Promise.all([
      import('@pkmn/dex'),
      import('@pkmn/data'),
      import('@pkmn/client'),
      import('@pkmn/view'),
    ]);
    const clientBattle = new Battle(new Generations(Dex));
    return new ProtocolContext(clientBattle, new LogFormatter('p1', clientBattle), opts);
  }

  /** Feeds lines to the tracker/formatter without producing events (used when replaying a saved battle). */
  feed(lines: readonly string[]): void {
    this.process(lines, false);
  }

  /** Feeds lines to the tracker/formatter and returns the events the game should play. */
  parse(lines: readonly string[]): BattleEvent[] {
    return this.process(lines, true);
  }

  private process(lines: readonly string[], emit: boolean): BattleEvent[] {
    const events: BattleEvent[] = [];
    let secretNext = false;
    let skipNext = false;
    for (const line of lines) {
      if (skipNext) {
        // Public (percentage) twin of the secret line we just processed.
        skipNext = false;
        continue;
      }
      if (line.startsWith('|split|')) {
        secretNext = true;
        continue;
      }
      if (secretNext) {
        secretNext = false;
        skipNext = true;
      }
      if (!line.startsWith('|')) continue;

      const { args, kwArgs } = Protocol.parseBattleLine(line);
      const argv = args as readonly string[];
      const cmd = argv[0] ?? '';
      const kw = kwArgs as Record<string, string | boolean | undefined>;

      // The formatter sees every line (it learns player names, gen, … from the dropped ones) and must
      // see it *before* the client battle applies it.
      let text = '';
      try {
        text = cleanText(this.formatter.formatText(args as ArgType, kwArgs as KWArgType));
      } catch {
        text = '';
      }
      const event = DROPPED_COMMANDS.has(cmd) ? null : this.mapEvent(cmd, argv, kw, text);
      // Every line (dropped ones included) updates the tracker so later texts have the right context.
      try {
        this.clientBattle.add(line);
      } catch {
        // The tracker is only used for text; a line it cannot digest must never break the game.
      }
      if (emit && event) events.push(event);
    }
    return events;
  }

  private parseHp(raw: string, side: SideID, ident: string): { hp: number; maxhp: number; status: StatusName } {
    const health = Protocol.parseHealth(raw as Protocol.PokemonHPStatus);
    if (!health) {
      return { hp: 0, maxhp: this.resolveMaxHp?.(side, ident) ?? 100, status: '' };
    }
    const fainted = health.fainted === true || raw.endsWith(' fnt');
    let maxhp = health.maxhp;
    if (fainted && !raw.includes('/')) {
      // "0 fnt" carries no max HP; ask the sim for the real value.
      maxhp = this.resolveMaxHp?.(side, ident) ?? maxhp;
    }
    return { hp: fainted ? 0 : health.hp, maxhp, status: toStatus(health.status) };
  }

  private mapEvent(
    cmd: string,
    a: readonly string[],
    kw: Record<string, string | boolean | undefined>,
    text: string,
  ): BattleEvent | null {
    const from = typeof kw.from === 'string' ? kw.from : undefined;
    switch (cmd) {
      case 'turn':
        return { kind: 'turn', turn: Number(a[1]) || 0, text: '' };
      case 'move': {
        const { side, ident } = parseIdent(a[1]);
        const target = a[2] && a[3] && a[3] !== 'null' ? normalizeIdent(a[3]) : undefined;
        return { kind: 'move', side, ident, move: a[2] ?? '', target, text };
      }
      case '-damage':
      case '-heal': {
        const { side, ident } = parseIdent(a[1]);
        const { hp, maxhp, status } = this.parseHp(a[2] ?? '', side, ident);
        return { kind: cmd === '-damage' ? 'damage' : 'heal', side, ident, hp, maxhp, status, from, text: stripHpParenthetical(text) };
      }
      case '-sethp': {
        const { side, ident } = parseIdent(a[1]);
        const { hp, maxhp } = this.parseHp(a[2] ?? '', side, ident);
        return { kind: 'sethp', side, ident, hp, maxhp, text: stripHpParenthetical(text) };
      }
      case 'faint': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'faint', side, ident, text };
      }
      case 'switch':
      case 'drag': {
        const { side, ident, name } = parseIdent(a[1]);
        const details = Protocol.parseDetails(name, a[1] as Protocol.PokemonIdent, a[2] as Protocol.PokemonDetails);
        const { hp, maxhp, status } = this.parseHp(a[3] ?? '', side, ident);
        return {
          kind: 'switch', side, ident, species: details.speciesForme, level: details.level, gender: toGender(details.gender),
          shiny: !!details.shiny, hp, maxhp, status, drag: cmd === 'drag', text,
        };
      }
      case 'detailschange':
      case 'replace': {
        const { side, ident, name } = parseIdent(a[1]);
        const details = Protocol.parseDetails(name, a[1] as Protocol.PokemonIdent, a[2] as Protocol.PokemonDetails);
        return { kind: 'formechange', side, ident, species: details.speciesForme, permanent: cmd === 'detailschange', text };
      }
      case '-formechange': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'formechange', side, ident, species: a[2] ?? '', permanent: false, text };
      }
      case '-transform': {
        const { side, ident } = parseIdent(a[1]);
        let species = '';
        try {
          species = a[2] ? this.clientBattle.getPokemonSpeciesForme(a[2] as Protocol.PokemonIdent) : '';
        } catch {
          species = '';
        }
        return { kind: 'formechange', side, ident, species: species || (a[2] ? parseIdent(a[2]).name : ''), permanent: false, text };
      }
      case '-status': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'status', side, ident, status: toStatus(a[2]), text };
      }
      case '-curestatus': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'curestatus', side, ident, status: toStatus(a[2]), text };
      }
      case '-boost':
      case '-unboost':
      case '-setboost': {
        const { side, ident } = parseIdent(a[1]);
        const stat = a[2] ?? '';
        if (!BOOST_IDS.has(stat)) return text ? { kind: 'message', text } : null;
        const n = Number(a[3]) || 0;
        return { kind: 'boost', side, ident, stat: stat as BoostID, amount: cmd === '-unboost' ? -n : n, text };
      }
      case '-clearboost':
      case '-clearnegativeboost':
      case '-clearpositiveboost': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'clearboost', side, ident, text };
      }
      case '-supereffective':
      case '-resisted':
      case '-immune': {
        const { side, ident } = parseIdent(a[1]);
        const effectiveness = cmd === '-supereffective' ? 'super' : cmd === '-resisted' ? 'resisted' : 'immune';
        return { kind: 'effectiveness', side, ident, effectiveness, text };
      }
      case '-crit': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'crit', side, ident, text };
      }
      case '-miss': {
        // |-miss|SOURCE|TARGET — the renderer wants the Pokémon that avoided the move.
        const { side, ident } = parseIdent(a[2] || a[1]);
        return { kind: 'miss', side, ident, text };
      }
      case '-fail': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'fail', side, ident, text };
      }
      case 'cant': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'cant', side, ident, reason: stripEffectPrefix(a[2]), text };
      }
      case '-weather': {
        const weather = !a[1] || a[1] === 'none' ? '' : a[1];
        return { kind: 'weather', weather, upkeep: kw.upkeep === true, text };
      }
      case '-fieldstart':
      case '-fieldend':
        return { kind: 'field', effect: stripEffectPrefix(a[1]), start: cmd === '-fieldstart', text };
      case '-sidestart':
      case '-sideend':
        return { kind: 'side', side: sideFromArg(a[1] ?? ''), condition: stripEffectPrefix(a[2]), start: cmd === '-sidestart', text };
      case '-item':
      case '-enditem': {
        if (!a[1]) return text ? { kind: 'message', text } : null;
        const { side, ident } = parseIdent(a[1]);
        return { kind: cmd === '-item' ? 'item' : 'enditem', side, ident, item: a[2] ?? '', text };
      }
      case '-ability': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'ability', side, ident, ability: a[2] ?? '', text };
      }
      case '-activate':
      case '-block': {
        // The parser upgrades "|-activate|X|Protect" to "|-block|X|move: Protect".
        if (!a[1]) return text ? { kind: 'message', text } : null;
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'activate', side, ident, effect: stripEffectPrefix(a[2]), text };
      }
      case '-singleturn':
      case '-singlemove': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'start', side, ident, effect: stripEffectPrefix(a[2]), text };
      }
      case '-primal': {
        // |-primal|IDENT|ORB — the new forme arrives in the following |detailschange|.
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'activate', side, ident, effect: a[2] ?? 'Primal Reversion', text };
      }
      case '-start': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'start', side, ident, effect: stripEffectPrefix(a[2]), text };
      }
      case '-end': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'end', side, ident, effect: stripEffectPrefix(a[2]), text };
      }
      case '-mega':
      case '-burst': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'mega', side, ident, species: a[2] ?? '', text };
      }
      case '-zpower': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'zpower', side, ident, text };
      }
      case '-terastallize': {
        const { side, ident } = parseIdent(a[1]);
        return { kind: 'terastallize', side, ident, type: a[2] ?? '', text };
      }
      case 'win': {
        const name = a[1] ?? '';
        const winner: SideID | 'tie' = name === this.names.p1 ? 'p1' : name === this.names.p2 ? 'p2' : 'tie';
        return { kind: 'win', winner, text };
      }
      case 'tie':
        return { kind: 'win', winner: 'tie', text };
      default:
        return text ? { kind: 'message', text } : null;
    }
  }
}

/** Parses protocol lines into events using (and updating) the given context. */
export function parseProtocolLines(lines: readonly string[], ctx: ProtocolContext): BattleEvent[] {
  return ctx.parse(lines);
}
