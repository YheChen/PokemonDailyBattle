/**
 * Display state: what the battle viewport is currently *showing*. Derived from the last authoritative
 * `BattleSnapshot` and mutated event by event while the animation queue plays, so HP bars drain, status
 * chips appear and sprites swap at the moment the dialogue says so. Pure functions, no React.
 */
import type {
  BattleEvent, BattleResult, BattleSetup, BattleSnapshot, BoostID, FieldView, GenderName, MoveView, PokemonView, SideID,
  StatusName, TypeName,
} from '@/lib/battle/types';

export interface DisplayPokemon {
  ident: string;
  /** Index in the side's party in request order (0 = active at snapshot time). */
  slot: number;
  species: string;
  name: string;
  level: number;
  gender: GenderName;
  shiny: boolean;
  hp: number;
  maxhp: number;
  status: StatusName;
  fainted: boolean;
  boosts: Record<BoostID, number>;
  types: TypeName[];
  item: string;
  ability: string;
  moves: MoveView[];
  volatiles: string[];
  terastallized?: string;
}

export interface DisplaySide {
  id: SideID;
  name: string;
  /** The Pokémon on the field (null before the first send-out). */
  active: DisplayPokemon | null;
  /** The six party members in request order. */
  party: DisplayPokemon[];
  /** Side condition id → layers. */
  sideConditions: Record<string, number>;
}

export interface DisplayState {
  turn: number;
  sides: Record<SideID, DisplaySide>;
  field: FieldView;
  ended: boolean;
  winner: SideID | 'tie' | null;
}

export const BOOST_IDS: readonly BoostID[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
export const BOOST_LABELS: Record<BoostID, string> = {
  atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', accuracy: 'Acc', evasion: 'Eva',
};

const TERRAIN_IDS: ReadonlySet<string> = new Set(['electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain']);
/** Side conditions that stack. */
const LAYERED: Record<string, number> = { spikes: 3, toxicspikes: 2 };

/** Showdown-style id: lowercase alphanumerics only. */
export function toId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function zeroBoosts(): Record<BoostID, number> {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
}

function fromView(p: PokemonView): DisplayPokemon {
  return {
    ident: p.ident,
    slot: p.slot,
    species: p.species,
    name: p.name,
    level: p.level,
    gender: p.gender,
    shiny: p.shiny,
    hp: p.hp,
    maxhp: p.maxhp,
    status: p.status,
    fainted: p.fainted,
    boosts: { ...p.boosts },
    types: [...p.types],
    item: p.item,
    ability: p.ability,
    moves: p.moves.map((m) => ({ ...m })),
    volatiles: [...p.volatiles],
    terastallized: p.terastallized,
  };
}

/** Builds the display state straight from an authoritative snapshot. */
export function displayFromSnapshot(snapshot: BattleSnapshot): DisplayState {
  const side = (id: SideID): DisplaySide => {
    const view = snapshot.sides[id];
    const party = view.pokemon.map(fromView);
    const active = view.active ? party.find((p) => p.ident === view.active?.ident) ?? fromView(view.active) : null;
    return {
      id,
      name: view.name,
      active: active ? { ...active } : null,
      party,
      sideConditions: { ...view.sideConditions },
    };
  };
  return {
    turn: snapshot.turn,
    sides: { p1: side('p1'), p2: side('p2') },
    field: { weather: snapshot.field.weather, terrain: snapshot.field.terrain, pseudoWeather: [...snapshot.field.pseudoWeather] },
    ended: snapshot.ended,
    winner: snapshot.winner,
  };
}

/** The same state with nothing on the field yet (used while the intro plays, before the send-outs). */
export function withoutActives(state: DisplayState): DisplayState {
  return {
    ...state,
    turn: 0,
    sides: {
      p1: { ...state.sides.p1, active: null },
      p2: { ...state.sides.p2, active: null },
    },
  };
}

function patchPokemon(
  state: DisplayState,
  side: SideID,
  ident: string,
  patch: (p: DisplayPokemon) => DisplayPokemon,
): DisplayState {
  const s = state.sides[side];
  const party = s.party.map((p) => (p.ident === ident ? patch(p) : p));
  const active = s.active && s.active.ident === ident ? patch(s.active) : s.active;
  return { ...state, sides: { ...state.sides, [side]: { ...s, party, active } } };
}

/** Renames the active Pokémon (and the party entry it was copied from) to `ident` / `species`. */
function revealActive(state: DisplayState, side: SideID, ident: string, species: string): DisplayState {
  const s = state.sides[side];
  const active = s.active;
  if (!active) return state;
  const name = ident.replace(/^p[12]: /, '');
  const rekey = (p: DisplayPokemon): DisplayPokemon => ({ ...p, ident, name, species: species || p.species });
  const oldIdent = active.ident;
  // The player's own party already lists the real Pokémon under its true ident; only the opponent's
  // party (snapshotted under the Illusion identity) carries a duplicate entry that must be renamed.
  let renamed = s.party.some((p) => p.ident === ident);
  const party = s.party.map((p) => {
    if (renamed || p.ident !== oldIdent || p.slot !== active.slot) return p;
    renamed = true;
    return rekey(p);
  });
  return { ...state, sides: { ...state.sides, [side]: { ...s, active: rekey(active), party } } };
}

function clampBoost(n: number): number {
  return Math.max(-6, Math.min(6, n));
}

/**
 * Applies one event to the display state and returns the new state (the input is never mutated).
 * Events that carry no state (messages, crits, …) return the input unchanged.
 */
export function applyEvent(state: DisplayState, event: BattleEvent): DisplayState {
  switch (event.kind) {
    case 'turn':
      return { ...state, turn: event.turn };
    case 'damage':
    case 'heal':
      return patchPokemon(state, event.side, event.ident, (p) => ({
        ...p,
        hp: Math.max(0, event.hp),
        maxhp: event.maxhp > 0 ? event.maxhp : p.maxhp,
        status: event.status,
        fainted: event.hp <= 0,
      }));
    case 'sethp':
      return patchPokemon(state, event.side, event.ident, (p) => ({
        ...p,
        hp: Math.max(0, event.hp),
        maxhp: event.maxhp > 0 ? event.maxhp : p.maxhp,
      }));
    case 'faint':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, hp: 0, fainted: true }));
    case 'switch': {
      const side = state.sides[event.side];
      const known = side.party.find((p) => p.ident === event.ident);
      const next: DisplayPokemon = {
        ident: event.ident,
        slot: known?.slot ?? 0,
        species: event.species,
        name: known?.name ?? event.ident.replace(/^p[12]: /, ''),
        level: event.level,
        gender: event.gender,
        shiny: event.shiny,
        hp: Math.max(0, event.hp),
        maxhp: event.maxhp > 0 ? event.maxhp : known?.maxhp ?? 100,
        status: event.status,
        fainted: event.hp <= 0,
        boosts: zeroBoosts(),
        types: known?.types ?? [],
        item: known?.item ?? '',
        ability: known?.ability ?? '',
        moves: known?.moves ?? [],
        volatiles: [],
        terastallized: known?.terastallized,
      };
      const party = side.party.map((p) =>
        p.ident === event.ident
          ? { ...p, species: event.species, hp: next.hp, maxhp: next.maxhp, status: next.status, boosts: zeroBoosts(), volatiles: [] }
          : p,
      );
      return { ...state, sides: { ...state.sides, [event.side]: { ...side, active: next, party } } };
    }
    case 'formechange':
    case 'mega': {
      const side = state.sides[event.side];
      if (side.active && side.active.ident !== event.ident) {
        // |replace| after an Illusion breaks: the Pokémon on the field was shown under another party
        // member's identity (singles: a forme change can only concern the active Pokémon). Re-key the
        // active and its party entry so the rest of the turn patches the revealed Pokémon.
        return revealActive(state, event.side, event.ident, event.species);
      }
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, species: event.species || p.species }));
    }
    case 'terastallize':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, terastallized: event.type || p.terastallized }));
    case 'status':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, status: event.status }));
    case 'curestatus':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, status: '' }));
    case 'boost':
      return patchPokemon(state, event.side, event.ident, (p) => ({
        ...p,
        boosts: { ...p.boosts, [event.stat]: clampBoost((p.boosts[event.stat] ?? 0) + event.amount) },
      }));
    case 'clearboost':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, boosts: zeroBoosts() }));
    case 'item':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, item: event.item || p.item }));
    case 'enditem':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, item: '' }));
    case 'ability':
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, ability: event.ability || p.ability }));
    case 'start': {
      const id = toId(event.effect);
      if (!id) return state;
      return patchPokemon(state, event.side, event.ident, (p) =>
        p.volatiles.includes(id) ? p : { ...p, volatiles: [...p.volatiles, id] },
      );
    }
    case 'end': {
      const id = toId(event.effect);
      if (!id) return state;
      return patchPokemon(state, event.side, event.ident, (p) => ({ ...p, volatiles: p.volatiles.filter((v) => v !== id) }));
    }
    case 'weather':
      return { ...state, field: { ...state.field, weather: toId(event.weather) } };
    case 'field': {
      const id = toId(event.effect);
      if (!id) return state;
      if (TERRAIN_IDS.has(id)) {
        return { ...state, field: { ...state.field, terrain: event.start ? id : state.field.terrain === id ? '' : state.field.terrain } };
      }
      const pseudoWeather = event.start
        ? state.field.pseudoWeather.includes(id) ? state.field.pseudoWeather : [...state.field.pseudoWeather, id]
        : state.field.pseudoWeather.filter((p) => p !== id);
      return { ...state, field: { ...state.field, pseudoWeather } };
    }
    case 'side': {
      const id = toId(event.condition);
      if (!id) return state;
      const side = state.sides[event.side];
      const sideConditions = { ...side.sideConditions };
      if (event.start) {
        const max = LAYERED[id];
        sideConditions[id] = max ? Math.min(max, (sideConditions[id] ?? 0) + 1) : 1;
      } else {
        delete sideConditions[id];
      }
      return { ...state, sides: { ...state.sides, [event.side]: { ...side, sideConditions } } };
    }
    case 'win':
      return { ...state, ended: true, winner: event.winner };
    default:
      return state;
  }
}

/** Applies a list of events in order. */
export function applyEvents(state: DisplayState, events: readonly BattleEvent[]): DisplayState {
  return events.reduce(applyEvent, state);
}

/** The type of a move as known by the side that used it (its active Pokémon's move list), or null. */
export function moveTypeFor(state: DisplayState, side: SideID, move: string): TypeName | null {
  const active = state.sides[side].active;
  if (!active) return null;
  const id = toId(move);
  const found = active.moves.find((m) => m.id === id || toId(m.name) === id);
  return found?.type ?? null;
}

/** The move entry (if known) of the side's active Pokémon. */
export function findMove(state: DisplayState, side: SideID, move: string): MoveView | null {
  const active = state.sides[side].active;
  if (!active) return null;
  const id = toId(move);
  return active.moves.find((m) => m.id === id || toId(m.name) === id) ?? null;
}

export function remaining(party: readonly { fainted: boolean }[]): number {
  return party.filter((p) => !p.fainted).length;
}

/**
 * Orders a side's Pokémon by the original team order (the sets of `BattleConfig`), falling back to
 * request order for anything that cannot be matched (nickname first, then species).
 */
export function inTeamOrder<T extends { name: string; species: string }>(
  pokemon: readonly T[],
  team: readonly { name?: string; species: string }[] | undefined,
): T[] {
  if (!team?.length) return [...pokemon];
  const left = [...pokemon];
  const out: T[] = [];
  for (const set of team) {
    const wanted = set.name || set.species;
    let idx = left.findIndex((p) => p.name === wanted);
    if (idx === -1) idx = left.findIndex((p) => toId(p.species) === toId(set.species));
    if (idx === -1) idx = left.findIndex((p) => toId(p.species).startsWith(toId(set.species)));
    if (idx !== -1) out.push(...left.splice(idx, 1));
  }
  return [...out, ...left];
}

/** Builds the `BattleResult` the game modes consume from the final snapshot. */
export function buildBattleResult(
  snapshot: BattleSnapshot,
  setup: BattleSetup,
  opts: { forfeited: boolean; finishedAt?: string },
): BattleResult {
  const p1 = inTeamOrder(snapshot.sides.p1.pokemon, setup.config.player.team);
  const p2 = inTeamOrder(snapshot.sides.p2.pokemon, setup.config.opponent.team);
  return {
    won: snapshot.winner === 'p1',
    forfeited: opts.forfeited,
    turns: snapshot.turn,
    playerRemaining: remaining(p1),
    opponentRemaining: remaining(p2),
    playerTeamStatus: p1.map((p) => ({ species: p.species, fainted: p.fainted })),
    opponentTeamStatus: p2.map((p) => ({ species: p.species, fainted: p.fainted })),
    trainerId: setup.trainerId,
    mode: setup.mode,
    finishedAt: opts.finishedAt ?? new Date().toISOString(),
  };
}

/* ---- labels ---- */

export const WEATHER_LABELS: Record<string, string> = {
  sunnyday: 'Sun',
  raindance: 'Rain',
  sandstorm: 'Sandstorm',
  hail: 'Hail',
  snow: 'Snow',
  snowscape: 'Snow',
  desolateland: 'Harsh Sun',
  primordialsea: 'Heavy Rain',
  deltastream: 'Strong Winds',
};

export const TERRAIN_LABELS: Record<string, string> = {
  electricterrain: 'Electric Terrain',
  grassyterrain: 'Grassy Terrain',
  psychicterrain: 'Psychic Terrain',
  mistyterrain: 'Misty Terrain',
};

export const PSEUDO_WEATHER_LABELS: Record<string, string> = {
  trickroom: 'Trick Room',
  gravity: 'Gravity',
  magicroom: 'Magic Room',
  wonderroom: 'Wonder Room',
  mudsport: 'Mud Sport',
  watersport: 'Water Sport',
  fairylock: 'Fairy Lock',
};

export const SIDE_CONDITION_LABELS: Record<string, string> = {
  stealthrock: 'Stealth Rock',
  spikes: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web',
  reflect: 'Reflect',
  lightscreen: 'Light Screen',
  auroraveil: 'Aurora Veil',
  tailwind: 'Tailwind',
  safeguard: 'Safeguard',
  mist: 'Mist',
  luckychant: 'Lucky Chant',
  gmaxsteelsurge: 'Steel Surge',
  gmaxwildfire: 'Wildfire',
  gmaxvolcalith: 'Volcalith',
  gmaxvinelash: 'Vine Lash',
  gmaxcannonade: 'Cannonade',
};

export const STATUS_LABELS: Record<Exclude<StatusName, ''>, string> = {
  brn: 'BRN', par: 'PAR', slp: 'SLP', frz: 'FRZ', psn: 'PSN', tox: 'TOX',
};

/** Visible weather group for overlays. */
export function weatherGroup(weather: string): 'sun' | 'rain' | 'sand' | 'snow' | '' {
  switch (weather) {
    case 'sunnyday':
    case 'desolateland':
      return 'sun';
    case 'raindance':
    case 'primordialsea':
      return 'rain';
    case 'sandstorm':
      return 'sand';
    case 'hail':
    case 'snow':
    case 'snowscape':
      return 'snow';
    default:
      return '';
  }
}

/** Label for a side condition with its layer count where it matters. */
export function sideConditionLabel(id: string, layers: number): string {
  const base = SIDE_CONDITION_LABELS[id] ?? id;
  return LAYERED[id] && layers > 1 ? `${base} ×${layers}` : base;
}

export function boostLabel(stat: BoostID, amount: number): string {
  return `${amount > 0 ? '+' : ''}${amount} ${BOOST_LABELS[stat]}`;
}
