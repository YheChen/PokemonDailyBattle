/**
 * Reads the live sim objects into the plain `BattleSnapshot` / `PlayerRequest` views the UI and
 * game modes consume. Pure functions; no sim import (the Battle is passed in).
 */
import type { Battle as SimBattle, Pokemon as SimPokemon, Side as SimSide } from '@pkmn/sim';
import { isRevivingRequest } from './legal';
import type {
  BattleSnapshot, BoostID, FieldView, GenderName, MoveCategory, MoveRequestView, MoveView, PlayerRequest, PokemonView,
  SideID, SideView, StatID, StatusName, TypeName,
} from './types';

const STATUS_NAMES: ReadonlySet<string> = new Set(['brn', 'par', 'slp', 'frz', 'psn', 'tox']);
const BOOST_IDS: readonly BoostID[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
const STAT_IDS: readonly StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function toStatus(raw: string): StatusName {
  return STATUS_NAMES.has(raw) ? (raw as StatusName) : '';
}

function toGender(raw: string): GenderName {
  return raw === 'M' || raw === 'F' ? raw : 'N';
}

/** Builds a MoveView from the format dex; pp/maxpp/disabled are supplied by the caller. */
export function buildMoveView(
  battle: SimBattle,
  id: string,
  state: { pp?: number; maxpp?: number; disabled?: boolean; name?: string },
): MoveView {
  const move = battle.dex.moves.get(id);
  if (!move.exists) {
    // Request-only pseudo moves (e.g. "Return 102" in older gens). Keep what we know.
    return {
      id, name: state.name ?? id, type: '???', category: 'Status', basePower: 0, accuracy: true,
      pp: state.pp ?? 0, maxpp: state.maxpp ?? state.pp ?? 0, disabled: !!state.disabled, target: 'normal', priority: 0, desc: '',
    };
  }
  const pp = state.pp ?? move.pp;
  const maxpp = state.maxpp ?? pp;
  return {
    id: move.id,
    name: move.name,
    type: move.type as TypeName,
    category: move.category as MoveCategory,
    basePower: move.basePower,
    accuracy: move.accuracy === true ? true : move.accuracy,
    pp,
    maxpp,
    disabled: !!state.disabled,
    target: move.target,
    priority: move.priority,
    desc: move.shortDesc || move.desc || '',
  };
}

function displayName(battle: SimBattle, kind: 'items' | 'abilities', id: string): string {
  if (!id) return '';
  const data = battle.dex[kind].get(id);
  return data.exists ? data.name : id;
}

/**
 * Illusion rule (Zoroark / Zorua): the protocol refers to a disguised Pokémon by the fullname of the party
 * member it impersonates — on BOTH sides (`|switch|p1a: Magikarp|…`, `|-damage|p2a: Magikarp|…`) — until the
 * illusion breaks, at which point `|replace|p2a: Zoroark|…` is emitted and later lines use the real name.
 * `PokemonView.ident` therefore always equals what the events of the same turn will say:
 * `(pokemon.illusion ?? pokemon).fullname`. While an illusion is active that ident is NOT unique (the disguised
 * Pokémon and the impersonated bench member share it); `slot` is the unique key of a party entry.
 *
 * Display fields (`species`, `name`, `level`, `gender`, `shiny`) follow the disguise for the opponent only — the
 * player knows their own team and the party menu must list the real Pokémon. HP, status, boosts, moves, types,
 * item and ability are always the real Pokémon's.
 */
export function buildPokemonView(battle: SimBattle, side: SimSide, pokemon: SimPokemon, slot: number): PokemonView {
  const protocolName = (pokemon.illusion ?? pokemon).fullname;
  const shown = side.id === 'p2' && pokemon.illusion ? pokemon.illusion : pokemon;
  const species = shown.species;
  const boosts = {} as Record<BoostID, number>;
  for (const id of BOOST_IDS) boosts[id] = pokemon.boosts[id] ?? 0;
  const baseStats = {} as Record<StatID, number>;
  for (const id of STAT_IDS) baseStats[id] = species.baseStats[id];
  const { atk, def, spa, spd, spe } = pokemon.storedStats;
  return {
    ident: protocolName,
    side: side.id === 'p2' ? 'p2' : 'p1',
    slot,
    speciesId: species.id,
    species: species.name,
    name: shown.name,
    level: shown.level,
    gender: toGender(shown.gender),
    shiny: !!shown.set.shiny,
    hp: pokemon.hp,
    maxhp: pokemon.maxhp,
    status: toStatus(pokemon.status),
    fainted: pokemon.fainted || pokemon.hp <= 0,
    active: pokemon.isActive,
    boosts,
    types: pokemon.getTypes() as TypeName[],
    item: displayName(battle, 'items', pokemon.item),
    ability: displayName(battle, 'abilities', pokemon.ability),
    moves: pokemon.moveSlots.map((slot) =>
      buildMoveView(battle, slot.id, { pp: slot.pp, maxpp: slot.maxpp, disabled: !!slot.disabled, name: slot.move }),
    ),
    volatiles: Object.keys(pokemon.volatiles),
    stats: { atk, def, spa, spd, spe },
    baseStats,
    teraType: pokemon.teraType || undefined,
    terastallized: pokemon.terastallized || undefined,
  };
}

export function buildSideView(battle: SimBattle, side: SimSide): SideView {
  const pokemon = side.pokemon.map((p, i) => buildPokemonView(battle, side, p, i));
  const sideConditions: Record<string, number> = {};
  for (const [id, state] of Object.entries(side.sideConditions)) {
    const layers = (state as { layers?: number | null }).layers;
    sideConditions[id] = typeof layers === 'number' ? layers : 1;
  }
  return {
    id: side.id === 'p2' ? 'p2' : 'p1',
    name: side.name,
    pokemon,
    active: pokemon.find((p) => p.active) ?? null,
    sideConditions,
    pokemonLeft: side.pokemonLeft,
  };
}

export function buildFieldView(battle: SimBattle): FieldView {
  return {
    weather: battle.field.weather,
    terrain: battle.field.terrain,
    pseudoWeather: Object.keys(battle.field.pseudoWeather),
  };
}

/** Maps `battle.winner` (a player *name*) to a side id. */
export function resolveWinner(battle: SimBattle): SideID | 'tie' | null {
  if (!battle.ended) return null;
  const winner = battle.winner ?? '';
  if (winner === battle.p1.name) return 'p1';
  if (winner === battle.p2.name) return 'p2';
  return 'tie';
}

export function buildSnapshot(battle: SimBattle): BattleSnapshot {
  return {
    turn: battle.turn,
    sides: { p1: buildSideView(battle, battle.p1), p2: buildSideView(battle, battle.p2) },
    field: buildFieldView(battle),
    ended: battle.ended,
    winner: resolveWinner(battle),
  };
}

/**
 * Builds the player's pending request from `battle.p1.activeRequest`.
 * `team` is the p1 `PokemonView[]` of the matching snapshot (request order; `switch N` ⇔ `team[N-1]`).
 */
export function buildPlayerRequest(battle: SimBattle, team: PokemonView[]): PlayerRequest | null {
  const request = battle.p1.activeRequest;
  if (battle.ended || !request) return null;
  if (request.wait) return { kind: 'wait' };
  if (request.teamPreview) return { kind: 'wait' };
  if (request.forceSwitch) return { kind: 'switch', team, reviving: isRevivingRequest(request) };

  const active = request.active[0];
  const pokemon = battle.p1.active[0] ?? null;
  const moves: MoveView[] = (active?.moves ?? []).map((m) => {
    const slot = pokemon?.moveSlots.find((s) => s.id === m.id);
    return buildMoveView(battle, m.id, {
      pp: m.pp ?? slot?.pp,
      maxpp: m.maxpp ?? slot?.maxpp,
      disabled: !!m.disabled,
      name: m.move,
    });
  });
  const canZMove = active?.canZMove
    ? (active.canZMove as ({ move: string } | null)[]).map((z) => (z && typeof z.move === 'string' ? z.move : null))
    : null;
  const view: MoveRequestView = {
    moves,
    trapped: !!active?.trapped,
    canMegaEvo: !!(active?.canMegaEvo || active?.canMegaEvoX || active?.canMegaEvoY),
    canUltraBurst: !!active?.canUltraBurst,
    canTerastallize: active?.canTerastallize ? active.canTerastallize : false,
    canZMove,
  };
  return { kind: 'move', active: view, team };
}
