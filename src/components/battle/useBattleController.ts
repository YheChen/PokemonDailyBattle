'use client';
/**
 * Owns the battle session for <BattleScreen />: boot (resume a saved battle or create a fresh one),
 * the intro → playing → ended phases, submitting choices, forfeiting, refresh-save and the result.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BattleResult, BattleSession, BattleSetup, BattleSnapshot, PlayerRequest, SubmitResult } from '@/lib/battle/types';
import { clearSavedBattle, getSavedBattle, matchesSavedBattle, saveBattle } from '@/lib/storage';
import { useSettings } from '@/lib/storage/useStorage';
import { useAnimationQueue, type AnimationQueue } from './animationQueue';
import { buildBattleResult, displayFromSnapshot, withoutActives, type DisplayState } from './displayState';
import { loadOpponentAI } from './loadAI';

export type BattlePhase = 'loading' | 'intro' | 'playing' | 'ended';

/** How the finished battle was left: `exit` is true for the overlay's Exit / "Exit battle" (the result is recorded either way). */
export interface BattleFinishMeta {
  exit: boolean;
}

export type BattleFinishHandler = (result: BattleResult, meta: BattleFinishMeta) => void;

export interface BattleController {
  phase: BattlePhase;
  /** Fatal error while creating the battle (nothing can be played). */
  fatal: string | null;
  /** True when the battle was restored from a save (the intro is skipped). */
  resumed: boolean;
  snapshot: BattleSnapshot | null;
  request: PlayerRequest | null;
  queue: AnimationQueue;
  /** True when no animation is playing and the player may act on `request`. */
  menuReady: boolean;
  /** Error returned by the engine for the last submitted choice (shown in the dialogue). */
  choiceError: string | null;
  result: BattleResult | null;
  forfeited: boolean;
  speed: ReturnType<typeof useSettings>['battleSpeed'];
  reducedMotion: boolean;
  /** Ends the intro and plays the send-outs. */
  beginBattle: () => void;
  submit: (choice: string) => void;
  forfeit: () => void;
  /** Clears the saved battle and hands the result to the mode exactly once (Continue and Exit both go through here). */
  finish: (opts?: { exit?: boolean }) => void;
  clearChoiceError: () => void;
}

const EMPTY_DISPLAY: DisplayState = {
  turn: 0,
  sides: {
    p1: { id: 'p1', name: '', active: null, party: [], sideConditions: {} },
    p2: { id: 'p2', name: '', active: null, party: [], sideConditions: {} },
  },
  field: { weather: '', terrain: '', pseudoWeather: [] },
  ended: false,
  winner: null,
};

interface Booted {
  session: BattleSession;
  resumed: boolean;
  forfeited: boolean;
}

/**
 * Resumes the save under `setup.saveKey` only when it is the very same battle (same key, seed and
 * opponent — see `matchesSavedBattle`); a save left by another battle under the same key is cleared
 * and a fresh session is created, so "Start Battle" never silently continues an old fight.
 */
async function boot(setup: BattleSetup): Promise<Booted> {
  const ai = await loadOpponentAI(setup.config.opponent.difficulty);
  const { createBattleSession, restoreBattleSession } = await import('@/lib/battle');
  const opts = ai ? { ai } : {};

  if (setup.saveKey) {
    const saved = getSavedBattle(setup.saveKey);
    if (saved) {
      if (matchesSavedBattle(saved, setup)) {
        try {
          const session = await restoreBattleSession(saved.serialized, opts);
          const forfeited = saved.serialized.inputLog.some((l) => l.startsWith('>forcewin p2'));
          return { session, resumed: true, forfeited };
        } catch (err) {
          console.warn('[battle] could not resume the saved battle, starting fresh', err);
          clearSavedBattle(setup.saveKey);
        }
      } else {
        console.info('[battle] the saved battle belongs to a different setup; starting fresh');
        clearSavedBattle(setup.saveKey);
      }
    }
  }
  const session = await createBattleSession(setup.config, opts);
  return { session, resumed: false, forfeited: false };
}

export function useBattleController(setup: BattleSetup, onFinish: BattleFinishHandler): BattleController {
  const settings = useSettings();
  const speed = settings.battleSpeed;
  const reducedMotion = settings.reducedMotion;

  const [phase, setPhase] = useState<BattlePhase>('loading');
  const [fatal, setFatal] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
  const [request, setRequest] = useState<PlayerRequest | null>(null);
  const [menuReady, setMenuReady] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [forfeited, setForfeited] = useState(false);

  const sessionRef = useRef<BattleSession | null>(null);
  const snapshotRef = useRef<BattleSnapshot | null>(null);
  const forfeitedRef = useRef(false);
  const finishedRef = useRef(false);
  const bootRef = useRef<Promise<Booted> | null>(null);
  const mountedRef = useRef(false);
  const setupRef = useRef(setup);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    setupRef.current = setup;
    onFinishRef.current = onFinish;
  });

  const endBattle = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;
    setResult(buildBattleResult(snap, setupRef.current, { forfeited: forfeitedRef.current }));
    setPhase('ended');
  }, []);

  const onDrain = useCallback(() => {
    setMenuReady(true);
    if (snapshotRef.current?.ended) endBattle();
  }, [endBattle]);

  const queue = useAnimationQueue(EMPTY_DISPLAY, { speed, reducedMotion, onDrain });
  const { snap, say, enqueue } = queue;

  /** Writes the refresh-resume save (the setup is stored with the session's effective config, seed included). */
  const persist = useCallback((session: BattleSession) => {
    const current = setupRef.current;
    if (!current.saveKey) return;
    try {
      saveBattle({
        setup: { ...current, config: session.config },
        serialized: session.serialize(),
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[battle] could not save the battle', err);
    }
  }, []);

  // Boot once (the promise lives in a ref so React Strict Mode's double effect reuses it).
  useEffect(() => {
    mountedRef.current = true;
    if (!bootRef.current) bootRef.current = boot(setupRef.current);
    bootRef.current.then(
      ({ session, resumed: wasResumed, forfeited: wasForfeited }) => {
        if (!mountedRef.current || sessionRef.current) return;
        sessionRef.current = session;
        const snap0 = session.snapshot();
        snapshotRef.current = snap0;
        forfeitedRef.current = wasForfeited;
        setForfeited(wasForfeited);
        setSnapshot(snap0);
        setResumed(wasResumed);
        if (wasResumed) {
          const started = session.start();
          snapshotRef.current = started.snapshot;
          setSnapshot(started.snapshot);
          setRequest(started.request);
          snap(displayFromSnapshot(started.snapshot));
          say('Battle resumed.');
          setMenuReady(true);
          if (started.snapshot.ended) {
            setResult(buildBattleResult(started.snapshot, setupRef.current, { forfeited: wasForfeited }));
            setPhase('ended');
          } else {
            setPhase('playing');
          }
        } else {
          // Save immediately: a refresh during the intro resumes this battle (and its generated team).
          persist(session);
          snap(withoutActives(displayFromSnapshot(snap0)));
          setPhase('intro');
        }
      },
      (err: unknown) => {
        if (!mountedRef.current) return;
        console.error('[battle] could not create the battle', err);
        setFatal(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      mountedRef.current = false;
    };
  }, [snap, say, persist]);

  const beginBattle = useCallback(() => {
    const session = sessionRef.current;
    if (!session || phase !== 'intro') return;
    setPhase('playing');
    setMenuReady(false);
    try {
      const started = session.start();
      // Persist before the first choice so a refresh between the send-outs and the first move resumes.
      persist(session);
      snapshotRef.current = started.snapshot;
      setSnapshot(started.snapshot);
      setRequest(started.request);
      enqueue(started.events, started.snapshot);
    } catch (err) {
      console.error('[battle] start failed', err);
      setFatal(err instanceof Error ? err.message : String(err));
    }
  }, [enqueue, persist, phase]);

  const submit = useCallback(
    (choice: string) => {
      const session = sessionRef.current;
      if (!session || phase !== 'playing' || !menuReady) return;
      let res: SubmitResult;
      try {
        res = session.submit(choice);
      } catch (err) {
        res = { ok: false, error: err instanceof Error ? err.message : String(err), request: null };
      }
      if (!res.ok) {
        setChoiceError(res.error || 'That choice is not possible right now.');
        // The engine's current request may differ from the one the menu was built from (e.g. trapped):
        // adopt it so the re-opened menu reflects what is actually possible.
        if (res.request) setRequest(res.request);
        return;
      }
      setChoiceError(null);
      persist(session);
      snapshotRef.current = res.snapshot;
      setSnapshot(res.snapshot);
      setRequest(res.request);
      setMenuReady(false);
      enqueue(res.events, res.snapshot);
    },
    [enqueue, menuReady, persist, phase],
  );

  const forfeit = useCallback(() => {
    const session = sessionRef.current;
    if (!session || phase !== 'playing') return;
    forfeitedRef.current = true;
    setForfeited(true);
    setChoiceError(null);
    let res;
    try {
      res = session.forfeit();
    } catch (err) {
      console.error('[battle] forfeit failed', err);
      return;
    }
    persist(session);
    snapshotRef.current = res.snapshot;
    setSnapshot(res.snapshot);
    setRequest(null);
    setMenuReady(false);
    enqueue(res.events, res.snapshot);
  }, [enqueue, persist, phase]);

  const finish = useCallback(
    (opts?: { exit?: boolean }) => {
      if (!result || finishedRef.current) return;
      finishedRef.current = true;
      clearSavedBattle(setupRef.current.saveKey);
      onFinishRef.current(result, { exit: !!opts?.exit });
    },
    [result],
  );

  const clearChoiceError = useCallback(() => setChoiceError(null), []);

  return useMemo<BattleController>(
    () => ({
      phase, fatal, resumed, snapshot, request, queue, menuReady, choiceError, result, forfeited, speed, reducedMotion,
      beginBattle, submit, forfeit, finish, clearChoiceError,
    }),
    [phase, fatal, resumed, snapshot, request, queue, menuReady, choiceError, result, forfeited, speed, reducedMotion, beginBattle, submit, forfeit, finish, clearChoiceError],
  );
}
