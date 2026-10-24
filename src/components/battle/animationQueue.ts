/**
 * Animation queue. The pure half turns `BattleEvent`s into timed presentation steps (what to apply to
 * the display state, what to say, which sprite effect to fire and for how long); the React hook plays
 * those steps one after another, lets a click skip the current wait and snaps to the authoritative
 * snapshot when everything has played.
 */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleEvent, BattleSnapshot, SideID } from '@/lib/battle/types';
import type { BattleSpeed } from '@/lib/storage/types';
import { typeColor } from '@/lib/data/typeColors';
import { applyEvent, displayFromSnapshot, findMove, type DisplayState } from './displayState';

export type SpriteAnim =
  | 'lunge'
  | 'hit'
  | 'hit-strong'
  | 'miss'
  | 'faint'
  | 'switch-out'
  | 'switch-in'
  | 'heal'
  | 'boost-up'
  | 'boost-down'
  | 'status-brn'
  | 'status-psn'
  | 'status-par'
  | 'status-slp'
  | 'status-frz'
  | 'glow';

export interface StepFx {
  sprite?: { side: SideID; anim: SpriteAnim };
  /** Type-colored burst drawn over the target. */
  burst?: { side: SideID; color: string };
  flash?: 'crit' | 'white';
}

export interface Step {
  /** Event applied to the display state when the step starts (null = presentation only). */
  event: BattleEvent | null;
  /** Dialogue text to show (null keeps the previous text). */
  text: string | null;
  fx: StepFx | null;
  /** Duration at normal speed in ms. */
  duration: number;
}

/** Mutable context carried across events of one timeline (last move used, deferred texts …). */
export interface PlanContext {
  lastMove: { side: SideID; move: string } | null;
  /** 'super' / 'crit' flags consumed by the next damage event. */
  strong: boolean;
  crit: boolean;
  /** Texts ("It's super effective!", "A critical hit!") shown after the HP bar has drained. */
  deferred: string[];
}

export function createPlanContext(): PlanContext {
  return { lastMove: null, strong: false, crit: false, deferred: [] };
}

/** Milliseconds per normal-speed unit: normal 1×, fast 0.45×, instant → no waits at all. */
export function speedFactor(speed: BattleSpeed): number {
  return speed === 'instant' ? 0 : speed === 'fast' ? 0.45 : 1;
}

/** Typewriter characters per second (Infinity = show the whole text at once). */
export function typewriterCps(speed: BattleSpeed, reducedMotion: boolean): number {
  if (speed === 'instant' || reducedMotion) return Infinity;
  return speed === 'fast' ? 110 : 45;
}

const TEXT_BASE = 450;
const TEXT_PER_CHAR = 22;

/** How long a piece of dialogue stays on screen at normal speed. */
export function textDuration(text: string): number {
  const longest = text.split('\n').reduce((n, line) => n + line.length, 0);
  return TEXT_BASE + longest * TEXT_PER_CHAR;
}

/** "[Garchomp's Rough Skin]" (the client's silent-ability style) → "Garchomp's Rough Skin". */
export function displayText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\[(.+)\]$/, '$1'))
    .join('\n');
}

function timed(text: string, base: number): number {
  return text ? Math.max(base, textDuration(text)) : base;
}

function textStep(text: string, base = 900): Step {
  return { event: null, text, fx: null, duration: timed(text, base) };
}

/** Steps for any deferred texts, clearing them. */
export function flushDeferred(ctx: PlanContext): Step[] {
  const steps = ctx.deferred.map((t) => textStep(t));
  ctx.deferred = [];
  ctx.strong = false;
  ctx.crit = false;
  return steps;
}

function statusAnim(status: string): SpriteAnim | null {
  switch (status) {
    case 'brn': return 'status-brn';
    case 'psn':
    case 'tox': return 'status-psn';
    case 'par': return 'status-par';
    case 'slp': return 'status-slp';
    case 'frz': return 'status-frz';
    default: return null;
  }
}

/**
 * Turns one event into presentation steps given the display state *before* the event. Order matters:
 * Showdown emits `|move|`, then `|-supereffective|`/`|-crit|`, then `|-damage|`; the game shows the move,
 * drains the HP bar with the hit effect and only then says "A critical hit!" / "It's super effective!".
 */
export function planEvent(raw: BattleEvent, state: DisplayState, ctx: PlanContext): Step[] {
  const event: BattleEvent = raw.text ? { ...raw, text: displayText(raw.text) } : raw;
  const steps: Step[] = [];
  const keepsDeferred = event.kind === 'damage' || event.kind === 'crit' || event.kind === 'effectiveness' || event.kind === 'sethp';
  if (!keepsDeferred && ctx.deferred.length) steps.push(...flushDeferred(ctx));

  switch (event.kind) {
    case 'move': {
      ctx.lastMove = { side: event.side, move: event.move };
      const known = findMove(state, event.side, event.move);
      const lunge = known ? known.category !== 'Status' : true;
      steps.push({
        event,
        text: event.text || null,
        fx: lunge ? { sprite: { side: event.side, anim: 'lunge' } } : null,
        duration: timed(event.text, 900),
      });
      return steps;
    }
    case 'damage': {
      const direct = !event.from && ctx.lastMove && ctx.lastMove.side !== event.side;
      let fx: StepFx | null = null;
      if (direct && ctx.lastMove) {
        const move = findMove(state, ctx.lastMove.side, ctx.lastMove.move);
        const color = move ? typeColor(move.type) : '#ffffff';
        fx = {
          sprite: { side: event.side, anim: ctx.strong ? 'hit-strong' : 'hit' },
          burst: { side: event.side, color },
          flash: ctx.crit ? 'crit' : undefined,
        };
      }
      steps.push({ event, text: event.text || null, fx, duration: timed(event.text, 700) });
      steps.push(...flushDeferred(ctx));
      return steps;
    }
    case 'heal':
      steps.push({ event, text: event.text || null, fx: { sprite: { side: event.side, anim: 'heal' } }, duration: timed(event.text, 700) });
      return steps;
    case 'sethp':
      steps.push({ event, text: event.text || null, fx: null, duration: timed(event.text, 700) });
      steps.push(...flushDeferred(ctx));
      return steps;
    case 'faint':
      steps.push({ event, text: event.text || null, fx: { sprite: { side: event.side, anim: 'faint' } }, duration: timed(event.text, 1100) });
      return steps;
    case 'switch': {
      const lines = event.text ? event.text.split('\n') : [];
      const current = state.sides[event.side].active;
      if (current && !current.fainted && current.ident !== event.ident && lines.length > 1) {
        steps.push({ event: null, text: lines[0], fx: { sprite: { side: event.side, anim: 'switch-out' } }, duration: timed(lines[0], 800) });
      }
      const line = lines.length ? lines[lines.length - 1] : '';
      steps.push({
        event,
        text: line || null,
        fx: { sprite: { side: event.side, anim: 'switch-in' }, flash: 'white' },
        duration: timed(line, 1000),
      });
      return steps;
    }
    case 'formechange':
    case 'mega':
    case 'terastallize':
      steps.push({ event, text: event.text || null, fx: { sprite: { side: event.side, anim: 'glow' } }, duration: timed(event.text, 900) });
      return steps;
    case 'status': {
      const anim = statusAnim(event.status);
      steps.push({ event, text: event.text || null, fx: anim ? { sprite: { side: event.side, anim } } : null, duration: timed(event.text, 900) });
      return steps;
    }
    case 'boost':
      steps.push({
        event,
        text: event.text || null,
        fx: { sprite: { side: event.side, anim: event.amount >= 0 ? 'boost-up' : 'boost-down' } },
        duration: timed(event.text, 900),
      });
      return steps;
    case 'effectiveness':
      if (event.effectiveness === 'immune') {
        steps.push({ event, text: event.text || null, fx: null, duration: timed(event.text, 900) });
      } else {
        if (event.effectiveness === 'super') ctx.strong = true;
        if (event.text) ctx.deferred.push(event.text);
        steps.push({ event, text: null, fx: null, duration: 0 });
      }
      return steps;
    case 'crit':
      ctx.crit = true;
      if (event.text) ctx.deferred.push(event.text);
      steps.push({ event, text: null, fx: null, duration: 0 });
      return steps;
    case 'miss':
      steps.push({ event, text: event.text || null, fx: { sprite: { side: event.side, anim: 'miss' } }, duration: timed(event.text, 900) });
      return steps;
    case 'win':
      steps.push({ event, text: event.text || null, fx: null, duration: timed(event.text, 1300) });
      return steps;
    case 'turn':
      steps.push({ event, text: null, fx: null, duration: 0 });
      return steps;
    default:
      steps.push({ event, text: event.text || null, fx: null, duration: event.text ? timed(event.text, 900) : 0 });
      return steps;
  }
}

/** Plans a whole timeline (used by tests and instant mode). */
export function planEvents(events: readonly BattleEvent[], state: DisplayState, ctx = createPlanContext()): Step[] {
  const steps: Step[] = [];
  let current = state;
  for (const event of events) {
    const planned = planEvent(event, current, ctx);
    for (const step of planned) if (step.event) current = applyEvent(current, step.event);
    steps.push(...planned);
  }
  steps.push(...flushDeferred(ctx));
  return steps;
}

/* ---------------------------------------------------------------------------------------------- */

export interface ActiveFx {
  /** Increments on every step so CSS animations restart. */
  seq: number;
  sprite: Partial<Record<SideID, SpriteAnim>>;
  burst: { side: SideID; color: string } | null;
  flash: 'crit' | 'white' | null;
}

export const NO_FX: ActiveFx = { seq: 0, sprite: {}, burst: null, flash: null };

export interface AnimationQueueOptions {
  speed: BattleSpeed;
  reducedMotion: boolean;
  /** Called once every queued event has played and the display snapped to the snapshot. */
  onDrain?: () => void;
}

export interface AnimationQueue {
  display: DisplayState;
  /** Current dialogue text (null = nothing said yet). */
  text: string | null;
  fx: ActiveFx;
  busy: boolean;
  /** Queues events and starts playing them. `after` is the authoritative state to snap to at the end. */
  enqueue: (events: readonly BattleEvent[], after: BattleSnapshot | null) => void;
  /** Skips the current wait. */
  skip: () => void;
  /** Replaces the display state immediately (no animation). */
  snap: (state: DisplayState) => void;
  /** Replaces the dialogue text immediately. */
  say: (text: string | null) => void;
  /** Duration of an HP bar transition for the current speed, in ms. */
  hpDuration: number;
}

export function useAnimationQueue(initial: DisplayState, opts: AnimationQueueOptions): AnimationQueue {
  const [display, setDisplay] = useState<DisplayState>(initial);
  const [text, setText] = useState<string | null>(null);
  const [fx, setFx] = useState<ActiveFx>(NO_FX);
  const [busy, setBusy] = useState(false);

  const stateRef = useRef<DisplayState>(initial);
  const eventsRef = useRef<BattleEvent[]>([]);
  const stepsRef = useRef<Step[]>([]);
  const ctxRef = useRef<PlanContext>(createPlanContext());
  const afterRef = useRef<BattleSnapshot | null>(null);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const seqRef = useRef(0);
  const optsRef = useRef(opts);
  const advanceRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    optsRef.current = opts;
  });

  const factor = speedFactor(opts.speed);
  const instant = factor === 0 || opts.reducedMotion;
  const hpDuration = instant ? 0 : Math.round(600 * factor);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    runningRef.current = false;
    clearTimer();
    const after = afterRef.current;
    afterRef.current = null;
    ctxRef.current = createPlanContext();
    if (after) stateRef.current = displayFromSnapshot(after);
    setDisplay(stateRef.current);
    setFx((f) => ({ ...NO_FX, seq: f.seq }));
    setBusy(false);
    optsRef.current.onDrain?.();
  }, [clearTimer]);

  const applyStep = useCallback((step: Step) => {
    if (step.event) stateRef.current = applyEvent(stateRef.current, step.event);
    setDisplay(stateRef.current);
    if (step.text !== null) setText(step.text);
    seqRef.current += 1;
    const seq = seqRef.current;
    if (step.fx) {
      const sprite: ActiveFx['sprite'] = {};
      if (step.fx.sprite) sprite[step.fx.sprite.side] = step.fx.sprite.anim;
      setFx({ seq, sprite, burst: step.fx.burst ?? null, flash: step.fx.flash ?? null });
    } else {
      setFx({ seq, sprite: {}, burst: null, flash: null });
    }
  }, []);

  const nextStep = useCallback((): Step | null => {
    while (stepsRef.current.length === 0) {
      const event = eventsRef.current.shift();
      if (!event) {
        const rest = flushDeferred(ctxRef.current);
        if (!rest.length) return null;
        stepsRef.current.push(...rest);
        break;
      }
      try {
        stepsRef.current.push(...planEvent(event, stateRef.current, ctxRef.current));
      } catch (err) {
        console.error('[battle] failed to plan event', event, err);
        stepsRef.current.push({ event, text: event.text || null, fx: null, duration: 0 });
      }
    }
    return stepsRef.current.shift() ?? null;
  }, []);

  const advance = useCallback(() => {
    clearTimer();
    const speedNow = speedFactor(optsRef.current.speed);
    if (speedNow === 0) {
      // Instant: apply everything, keep the last line of dialogue.
      let step = nextStep();
      let last: string | null = null;
      while (step) {
        try {
          if (step.event) stateRef.current = applyEvent(stateRef.current, step.event);
        } catch (err) {
          console.error('[battle] failed to apply event', step.event, err);
        }
        if (step.text !== null) last = step.text;
        step = nextStep();
      }
      if (last !== null) setText(last);
      finish();
      return;
    }
    const step = nextStep();
    if (!step) {
      finish();
      return;
    }
    try {
      applyStep(step);
    } catch (err) {
      console.error('[battle] failed to apply event', step.event, err);
      eventsRef.current = [];
      stepsRef.current = [];
      finish();
      return;
    }
    const wait = Math.max(0, Math.round(step.duration * speedNow));
    // Zero-length steps still go through a macrotask so React can paint between them.
    timerRef.current = window.setTimeout(() => advanceRef.current(), wait);
  }, [applyStep, clearTimer, finish, nextStep]);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const enqueue = useCallback(
    (events: readonly BattleEvent[], after: BattleSnapshot | null) => {
      eventsRef.current.push(...events);
      if (after) afterRef.current = after;
      if (runningRef.current) return;
      runningRef.current = true;
      setBusy(true);
      advance();
    },
    [advance],
  );

  const skip = useCallback(() => {
    if (!runningRef.current) return;
    advance();
  }, [advance]);

  const snap = useCallback((state: DisplayState) => {
    stateRef.current = state;
    setDisplay(state);
  }, []);

  const say = useCallback((t: string | null) => setText(t), []);

  useEffect(() => clearTimer, [clearTimer]);

  return { display, text, fx, busy, enqueue, skip, snap, say, hpDuration };
}
