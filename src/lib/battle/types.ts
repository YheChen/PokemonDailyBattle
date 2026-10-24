/**
 * Core battle contract shared by the engine wrapper, the AI, the UI and the game modes.
 * See ARCHITECTURE.md. Keep this file dependency-light: only type imports from @pkmn/sim.
 */
import type { PokemonSet, Battle as SimBattle, Side as SimSide, PRNG } from '@pkmn/sim';

/** The sim's request object (MoveRequest | SwitchRequest | WaitRequest | TeamPreviewRequest). */
export type ChoiceRequest = NonNullable<SimSide['activeRequest']>;
export type MoveRequest = Extract<ChoiceRequest, { active: unknown }>;
export type SwitchRequest = Extract<ChoiceRequest, { forceSwitch: boolean[] }>;

export type { PokemonSet, SimBattle, SimSide, PRNG };

/** Battle format used for every battle unless overridden. National Dex singles, no team preview. */
export const DEFAULT_FORMAT = 'gen9nationaldex@@@!Team Preview';
/** Alternative "Gen 9 only" format (no Megas / Z-Moves). */
export const GEN9_ONLY_FORMAT = 'gen9anythinggoes@@@!Team Preview';

export type SideID = 'p1' | 'p2';
export type StatusName = 'brn' | 'par' | 'slp' | 'frz' | 'psn' | 'tox' | '';
export type BoostID = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';
export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type GenderName = 'M' | 'F' | 'N';
export type Difficulty = 'normal' | 'hard' | 'champion';
export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice' | 'Fighting' | 'Poison' | 'Ground'
  | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy' | 'Stellar' | '???';

export interface BattleParticipant {
  name: string;
  team: PokemonSet[];
  /** Asset id for the trainer portrait (see assets provider). */
  avatar?: string;
}

export interface BattleConfig {
  /** Showdown format id (with optional @@@ custom rules). Defaults to DEFAULT_FORMAT. */
  formatid?: string;
  /** PRNG seed string, e.g. "12,345,6789,10". Random when omitted. */
  seed?: string;
  player: BattleParticipant;
  opponent: BattleParticipant & { difficulty: Difficulty; trainerId?: string };
}

export interface MoveView {
  id: string;
  name: string;
  type: TypeName;
  category: MoveCategory;
  basePower: number;
  /** Accuracy percentage, or true when the move never misses. */
  accuracy: number | true;
  pp: number;
  maxpp: number;
  disabled: boolean;
  target: string;
  priority: number;
  desc: string;
}

export interface PokemonView {
  /** "p1: Garchomp" */
  ident: string;
  side: SideID;
  /** Index in the side's party in request order (0 = active). */
  slot: number;
  speciesId: string;
  /** Display forme name, e.g. "Garchomp", "Rotom-Wash", "Charizard-Mega-X". */
  species: string;
  /** Nickname (equals species name for generated teams). */
  name: string;
  level: number;
  gender: GenderName;
  shiny: boolean;
  hp: number;
  maxhp: number;
  status: StatusName;
  fainted: boolean;
  active: boolean;
  boosts: Record<BoostID, number>;
  types: TypeName[];
  item: string;
  ability: string;
  moves: MoveView[];
  /** Volatile condition ids currently applied (confusion, substitute, leechseed, …). */
  volatiles: string[];
  stats: Record<Exclude<StatID, 'hp'>, number>;
  baseStats: Record<StatID, number>;
  teraType?: string;
  terastallized?: string;
}

export interface SideView {
  id: SideID;
  name: string;
  pokemon: PokemonView[];
  active: PokemonView | null;
  /** Side condition id → layers (stealthrock: 1, spikes: 2, reflect: 1 …). */
  sideConditions: Record<string, number>;
  pokemonLeft: number;
}

export interface FieldView {
  weather: string;
  terrain: string;
  pseudoWeather: string[];
}

export interface BattleSnapshot {
  turn: number;
  sides: { p1: SideView; p2: SideView };
  field: FieldView;
  ended: boolean;
  winner: SideID | 'tie' | null;
}

/** Parsed protocol event with ready-to-display text ('' when the game shows nothing). */
export type BattleEvent =
  | { kind: 'turn'; turn: number; text: string }
  | { kind: 'move'; side: SideID; ident: string; move: string; target?: string; text: string }
  | { kind: 'damage'; side: SideID; ident: string; hp: number; maxhp: number; status: StatusName; from?: string; text: string }
  | { kind: 'heal'; side: SideID; ident: string; hp: number; maxhp: number; status: StatusName; from?: string; text: string }
  | { kind: 'sethp'; side: SideID; ident: string; hp: number; maxhp: number; text: string }
  | { kind: 'faint'; side: SideID; ident: string; text: string }
  | { kind: 'switch'; side: SideID; ident: string; species: string; level: number; gender: GenderName; shiny: boolean; hp: number; maxhp: number; status: StatusName; drag: boolean; text: string }
  | { kind: 'formechange'; side: SideID; ident: string; species: string; permanent: boolean; text: string }
  | { kind: 'status'; side: SideID; ident: string; status: StatusName; text: string }
  | { kind: 'curestatus'; side: SideID; ident: string; status: StatusName; text: string }
  | { kind: 'boost'; side: SideID; ident: string; stat: BoostID; amount: number; text: string }
  | { kind: 'clearboost'; side: SideID; ident: string; text: string }
  | { kind: 'effectiveness'; side: SideID; ident: string; effectiveness: 'super' | 'resisted' | 'immune'; text: string }
  | { kind: 'crit'; side: SideID; ident: string; text: string }
  | { kind: 'miss'; side: SideID; ident: string; text: string }
  | { kind: 'fail'; side: SideID; ident: string; text: string }
  | { kind: 'cant'; side: SideID; ident: string; reason: string; text: string }
  | { kind: 'weather'; weather: string; upkeep: boolean; text: string }
  | { kind: 'field'; effect: string; start: boolean; text: string }
  | { kind: 'side'; side: SideID; condition: string; start: boolean; text: string }
  | { kind: 'item'; side: SideID; ident: string; item: string; text: string }
  | { kind: 'enditem'; side: SideID; ident: string; item: string; text: string }
  | { kind: 'ability'; side: SideID; ident: string; ability: string; text: string }
  | { kind: 'activate'; side: SideID; ident: string; effect: string; text: string }
  | { kind: 'start'; side: SideID; ident: string; effect: string; text: string }
  | { kind: 'end'; side: SideID; ident: string; effect: string; text: string }
  | { kind: 'mega'; side: SideID; ident: string; species: string; text: string }
  | { kind: 'zpower'; side: SideID; ident: string; text: string }
  | { kind: 'terastallize'; side: SideID; ident: string; type: string; text: string }
  | { kind: 'message'; text: string }
  | { kind: 'win'; winner: SideID | 'tie'; text: string };

export type BattleEventKind = BattleEvent['kind'];

export interface MoveRequestView {
  moves: MoveView[];
  trapped: boolean;
  canMegaEvo: boolean;
  /** Ultra Burst available this turn (Necrozma with Ultranecrozium Z) → "move N ultra". */
  canUltraBurst: boolean;
  /** Tera type when terastallization is available this turn, otherwise false. */
  canTerastallize: string | false;
  /** Per-move Z-move names (null when a move has no Z-move) or null when no Z-move is available. */
  canZMove: (string | null)[] | null;
}

export type PlayerRequest =
  | { kind: 'move'; active: MoveRequestView; team: PokemonView[] }
  /**
   * Forced switch. When `reviving` is true (Revival Blessing just resolved) the legal targets are the
   * FAINTED party members (the chosen one is revived to half HP) instead of the healthy ones.
   */
  | { kind: 'switch'; team: PokemonView[]; reviving: boolean }
  | { kind: 'wait' };

export interface TurnResult {
  /** Events produced since the previous result, in order. */
  events: BattleEvent[];
  snapshot: BattleSnapshot;
  request: PlayerRequest | null;
  ended: boolean;
  winner: SideID | 'tie' | null;
}

export type SubmitResult =
  | ({ ok: true } & TurnResult)
  /** `request` is the engine's current request after the refusal (it may have changed, e.g. a trapped flag). */
  | { ok: false; error: string; request: PlayerRequest | null };

export interface SerializedBattle {
  version: 1;
  config: BattleConfig;
  /** Showdown input log ("&gt;start …", "&gt;player p1 …", "&gt;p1 move 1", …). */
  inputLog: string[];
}

export interface AIContext {
  battle: SimBattle;
  side: SimSide;
  request: ChoiceRequest;
  prng: PRNG;
  difficulty: Difficulty;
}

export interface OpponentAgent {
  /** Returns a Showdown choice string legal for ctx.request. */
  choose(ctx: AIContext): string;
}

export interface BattleSession {
  readonly config: BattleConfig;
  /** Plays the intro switch-ins and returns the first request. Call exactly once. */
  start(): TurnResult;
  /** Submits the player's choice ("move 1", "move 2 mega", "switch 3", …) and advances until the player must act again. */
  submit(choice: string): SubmitResult;
  forfeit(): TurnResult;
  snapshot(): BattleSnapshot;
  request(): PlayerRequest | null;
  serialize(): SerializedBattle;
  /** Current turn number. */
  readonly turn: number;
  readonly ended: boolean;
}

export interface SessionOptions {
  ai?: OpponentAgent;
}

/** What a game mode hands to <BattleScreen />. */
export interface BattleSetup {
  config: BattleConfig;
  /** Trainer id for portrait, dialogue and arena. */
  trainerId?: string;
  /** Key used to save/resume this battle across refreshes (null = never persist). */
  saveKey: string | null;
  /** Mode label shown in the result screen. */
  mode: 'daily' | 'free' | 'boss-rush' | 'custom';
}

export interface BattleResult {
  won: boolean;
  forfeited: boolean;
  turns: number;
  playerRemaining: number;
  opponentRemaining: number;
  /** Fainted flags for the player's team in party order. */
  playerTeamStatus: { species: string; fainted: boolean }[];
  opponentTeamStatus: { species: string; fainted: boolean }[];
  trainerId?: string;
  mode: BattleSetup['mode'];
  finishedAt: string;
}
