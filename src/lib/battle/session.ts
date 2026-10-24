/**
 * Battle session: wraps a `@pkmn/sim` Battle for singles play against an `OpponentAgent`.
 * See ARCHITECTURE.md "Session turn flow". React-free; works in Node and the browser.
 */
import type { Battle as SimBattle, ID, PRNG, PRNGSeed, SideID as SimSideID } from '@pkmn/sim';
import { firstLegalChoice } from './legal';
import { ProtocolContext } from './protocol';
import { RandomAgent } from './randomAgent';
import { buildPlayerRequest, buildSnapshot } from './snapshot';
import {
  DEFAULT_FORMAT,
  type BattleConfig, type BattleEvent, type BattleSession, type BattleSnapshot, type OpponentAgent, type PlayerRequest,
  type SerializedBattle, type SessionOptions, type SideID, type SubmitResult, type TurnResult,
} from './types';

export const SESSION_VERSION = 1 as const;

type SimModule = typeof import('@pkmn/sim');

/** Thrown by `restoreBattleSession` when a logged choice is refused by the rebuilt battle. */
export const REPLAY_DIVERGED = 'replay-diverged';

/** Upper bound on consecutive opponent-only actions between two player prompts (forced switches). */
const MAX_OPPONENT_ACTIONS = 64;

/**
 * Derives the opponent agent's PRNG from the battle seed so its rolls are deterministic per battle
 * but not the same stream the engine consumes.
 */
function createAgentPrng(sim: SimModule, seed: PRNGSeed): PRNG {
  const parts = seed.split(',');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const derived = parts.map((p, i) => (Number(p) * 7919 + 104729 + i * 31) % 65536).join(',') as PRNGSeed;
    return new sim.PRNG(derived);
  }
  const prng = new sim.PRNG(seed);
  for (let i = 0; i < 32; i++) prng.random();
  return prng;
}

/** Human-readable label for a choice string, e.g. `"Earthquake"`, `"Switch → Lucario"`. */
export function describeChoice(choice: string, request: PlayerRequest | null): string {
  const parts = choice.trim().split(/\s+/);
  const kind = parts[0];
  if (kind === 'move') {
    const moves = request?.kind === 'move' ? request.active.moves : [];
    const index = Number(parts[1]) - 1;
    const move = Number.isInteger(index)
      ? moves[index]
      : moves.find((m) => m.id === parts[1]?.toLowerCase() || m.name.toLowerCase() === parts[1]?.toLowerCase());
    const name = move?.name ?? (Number.isInteger(index) ? `Move ${index + 1}` : parts[1] ?? 'Move');
    const mod = parts.find((p, i) => i >= 2 && ['mega', 'megax', 'megay', 'zmove', 'terastallize', 'ultra'].includes(p));
    const suffix =
      mod === 'zmove' ? ' (Z-Move)'
      : mod === 'terastallize' ? ' (Terastallize)'
      : mod === 'ultra' ? ' (Ultra Burst)'
      : mod ? ' (Mega Evolution)'
      : '';
    return `${name}${suffix}`;
  }
  if (kind === 'switch') {
    const index = Number(parts[1]) - 1;
    const team = request && request.kind !== 'wait' ? request.team : [];
    const target = team[index];
    return `Switch → ${target ? target.name || target.species : `#${index + 1}`}`;
  }
  if (kind === 'pass') return 'Pass';
  return choice;
}

interface BuildOptions {
  /** Automatically resolve a Team Preview request (only for fresh battles; a replay carries the choices). */
  autoTeamPreview: boolean;
}

class SimBattleSession implements BattleSession {
  readonly config: BattleConfig;
  private readonly battle: SimBattle;
  private readonly ctx: ProtocolContext;
  private readonly agent: OpponentAgent;
  private readonly agentPrng: PRNG;
  private readonly pending: string[];
  private started = false;

  private constructor(
    config: BattleConfig,
    battle: SimBattle,
    pending: string[],
    ctx: ProtocolContext,
    agent: OpponentAgent,
    agentPrng: PRNG,
  ) {
    this.config = config;
    this.battle = battle;
    this.pending = pending;
    this.ctx = ctx;
    this.agent = agent;
    this.agentPrng = agentPrng;
  }

  static async build(sim: SimModule, config: BattleConfig, agent: OpponentAgent, opts: BuildOptions): Promise<SimBattleSession> {
    if (!config.seed) throw new Error('BattleConfig.seed is required');
    const seed = config.seed as PRNGSeed;
    const formatid = (config.formatid || DEFAULT_FORMAT) as ID;
    const pending: string[] = [];
    const battle = new sim.Battle({
      formatid,
      seed,
      send: (type, data) => {
        if (type !== 'update') return;
        if (Array.isArray(data)) pending.push(...data);
        else pending.push(data);
      },
    });

    const p1Name = config.player.name || 'Player';
    let p2Name = config.opponent.name || 'Opponent';
    if (p2Name === p1Name) p2Name = `${p2Name} (2)`;
    battle.setPlayer('p1', { name: p1Name, team: config.player.team });
    battle.setPlayer('p2', { name: p2Name, team: config.opponent.team });

    if (opts.autoTeamPreview && battle.p1.requestState === 'teampreview') {
      battle.choose('p1', 'default');
      battle.choose('p2', 'default');
    }

    const ctx = await ProtocolContext.create({
      names: { p1: battle.p1.name, p2: battle.p2.name },
      // Protocol idents name a disguised Pokémon (Illusion) after the party member it impersonates, so prefer
      // the active Pokémon that currently answers to that name over a plain fullname lookup.
      resolveMaxHp: (side: SideID, ident: string) => {
        const active = battle[side].active.find((p) => !!p && (p.illusion ?? p).fullname === ident);
        return (active ?? battle.getPokemon(ident))?.maxhp;
      },
    });
    return new SimBattleSession(config, battle, pending, ctx, agent, createAgentPrng(sim, seed));
  }

  get turn(): number {
    return this.battle.turn;
  }

  get ended(): boolean {
    return this.battle.ended;
  }

  snapshot(): BattleSnapshot {
    return buildSnapshot(this.battle);
  }

  request(): PlayerRequest | null {
    return buildPlayerRequest(this.battle, buildSnapshot(this.battle).sides.p1.pokemon);
  }

  serialize(): SerializedBattle {
    return { version: SESSION_VERSION, config: this.config, inputLog: [...this.battle.inputLog] };
  }

  start(): TurnResult {
    if (this.started) return this.result([]);
    this.started = true;
    // The opening send-outs can already force the opponent to act (Eject Pack vs Intimidate, Emergency Exit
    // from hazards…) while the player waits: resolve that here exactly as `submit()` does after a turn.
    this.advanceOpponent();
    return this.result(this.drain());
  }

  submit(choice: string): SubmitResult {
    if (this.battle.ended) return this.refuse('The battle has already ended.');
    if (!this.started) return this.refuse('The battle has not started yet.');
    const p1 = this.battle.p1;
    if (!p1.requestState) return this.refuse("It's not your turn.");

    let ok: boolean;
    let thrown: string | undefined;
    try {
      ok = this.battle.choose('p1', choice);
    } catch (err) {
      ok = false;
      thrown = err instanceof Error ? err.message : String(err);
    }
    if (!ok) {
      const error = thrown ?? p1.choice.error ?? '';
      p1.clearChoice();
      return this.refuse(error || `Invalid choice: ${choice}`);
    }
    this.advanceOpponent();
    return { ok: true, ...this.result(this.drain()) };
  }

  /** A refused choice hands back the engine's current request (it may have changed, e.g. a trap was revealed). */
  private refuse(error: string): SubmitResult {
    return { ok: false, error, request: this.request() };
  }

  forfeit(): TurnResult {
    if (!this.battle.ended) this.battle.forceWin('p2');
    this.started = true;
    return this.result(this.drain());
  }

  /** Replays a saved input log with events suppressed. Throws `replay-diverged` on any refused choice. */
  replay(inputLog: readonly string[]): void {
    this.started = true;
    for (const line of inputLog) {
      if (!line.startsWith('>')) continue;
      const space = line.indexOf(' ');
      const head = space === -1 ? line.slice(1) : line.slice(1, space);
      const rest = space === -1 ? '' : line.slice(space + 1);
      if (head === 'p1' || head === 'p2') {
        if (head === 'p2') this.consultAgent();
        if (!this.tryChoose(head, rest)) throw new Error(REPLAY_DIVERGED);
      } else if (head === 'forcewin') {
        const side = rest.trim();
        if (side !== 'p1' && side !== 'p2') throw new Error(REPLAY_DIVERGED);
        if (!this.battle.forceWin(side)) throw new Error(REPLAY_DIVERGED);
      } else if (head === 'forcetie') {
        if (!this.battle.forceWin(null)) throw new Error(REPLAY_DIVERGED);
      }
      // ">start", ">player", ">version" … are implied by the config.
    }
    // A complete log ends with the player to act, so this is a no-op; it only matters for a log that stopped
    // while the opponent still owed a forced switch (the restored battle must never sit on `wait`).
    this.advanceOpponent();
    this.drain(true);
  }

  // ---- internals -------------------------------------------------------------------------------

  private result(events: BattleEvent[]): TurnResult {
    const snapshot = buildSnapshot(this.battle);
    return {
      events,
      snapshot,
      request: buildPlayerRequest(this.battle, snapshot.sides.p1.pokemon),
      ended: snapshot.ended,
      winner: snapshot.winner,
    };
  }

  /** Flushes the sim log into protocol lines and (unless suppressed) parses them into events. */
  private drain(suppress = false): BattleEvent[] {
    this.battle.sendUpdates();
    const lines = this.pending.splice(0, this.pending.length);
    if (suppress) {
      this.ctx.feed(lines);
      return [];
    }
    return this.ctx.parse(lines);
  }

  private tryChoose(side: SimSideID, input: string): boolean {
    try {
      return this.battle.choose(side, input);
    } catch {
      return false;
    }
  }

  /** Asks the agent for p2's choice and returns it ('' when the agent threw). */
  private consultAgent(): string {
    const side = this.battle.p2;
    const request = side.activeRequest;
    if (!request) return '';
    try {
      return this.agent.choose({
        battle: this.battle,
        side,
        request,
        prng: this.agentPrng,
        difficulty: this.config.opponent.difficulty,
      });
    } catch {
      return '';
    }
  }

  /** Lets p2 act whenever it must and the player does not; stops when the player must act or the battle ended. */
  private advanceOpponent(): void {
    for (let guard = 0; guard < MAX_OPPONENT_ACTIONS; guard++) {
      if (this.battle.ended) return;
      const p1 = this.battle.p1;
      const p2 = this.battle.p2;
      if (p1.requestState && !p1.isChoiceDone()) return;
      if (!p2.requestState || p2.isChoiceDone()) return;
      this.opponentChoose();
    }
    throw new Error('The opponent could not reach a player prompt');
  }

  private opponentChoose(): void {
    const side = this.battle.p2;
    const request = side.activeRequest;
    const choice = this.consultAgent();
    if (choice && this.tryChoose('p2', choice)) return;
    side.clearChoice();
    const fallback = firstLegalChoice(request);
    if (fallback && fallback !== choice && this.tryChoose('p2', fallback)) return;
    side.clearChoice();
    if (this.tryChoose('p2', 'default')) return;
    throw new Error(`Opponent has no legal choice: ${side.choice.error}`);
  }
}

async function loadSim(): Promise<SimModule> {
  return import('@pkmn/sim');
}

/** Creates a fresh battle from `config`. `start()` must be called once to get the intro events and first request. */
export async function createBattleSession(config: BattleConfig, opts: SessionOptions = {}): Promise<BattleSession> {
  const sim = await loadSim();
  const seed = config.seed || sim.PRNG.generateSeed();
  const effective: BattleConfig = { ...config, seed };
  return SimBattleSession.build(sim, effective, opts.ai ?? new RandomAgent(), { autoTeamPreview: true });
}

/**
 * Rebuilds a battle from its config and replays the saved input log. The returned session is already
 * started (`start()` returns the current state with no events). Throws `Error('replay-diverged')` when
 * the log cannot be replayed (different engine data, corrupt save…).
 */
export async function restoreBattleSession(saved: SerializedBattle, opts: SessionOptions = {}): Promise<BattleSession> {
  if (saved.version !== SESSION_VERSION) throw new Error(`Unsupported battle save version: ${String(saved.version)}`);
  if (!saved.config?.seed) throw new Error(REPLAY_DIVERGED);
  const sim = await loadSim();
  const session = await SimBattleSession.build(sim, saved.config, opts.ai ?? new RandomAgent(), { autoTeamPreview: false });
  session.replay(saved.inputLog ?? []);
  return session;
}
