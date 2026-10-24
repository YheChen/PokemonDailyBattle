'use client';
/**
 * The DS-style battle screen. Self-contained: owns the session (via useBattleController), the
 * animation queue, the display state and every menu. Game modes only pass a `BattleSetup` and
 * receive a `BattleResult`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import { ARENAS, getTrainer } from '@/data/trainers';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/components/ui/cn';
import { ActionMenu } from './ActionMenu';
import { BattleViewport, type ArenaLook } from './BattleViewport';
import { DialogueBox } from './DialogueBox';
import { MoveMenu } from './MoveMenu';
import { PartyMenu } from './PartyMenu';
import { ResultOverlay } from './ResultOverlay';
import { TrainerIntroCard, useIntroSequence } from './TrainerIntro';
import { speedFactor, typewriterCps } from './animationQueue';
import { useBattleController, type BattleFinishMeta } from './useBattleController';
import './battle.css';

export type BattleScreenProps = {
  setup: BattleSetup;
  /** Called exactly once per battle with the result; `meta.exit` says the player left via Exit rather than Continue. */
  onFinish: (result: BattleResult, meta: BattleFinishMeta) => void;
  onExit?: () => void;
};

type Menu = 'action' | 'moves' | 'party';

const DEFAULT_ARENA: ArenaLook = {
  name: 'Battle Arena',
  background: 'meadow',
  fallback: 'linear-gradient(#a6d98a, #4e8a3a)',
};

const BAG_TEXT = 'Items are disabled in competitive battles.';
/** Must match the line the controller says after a restore. */
const RESUMED_TEXT = 'Battle resumed.';

export function BattleScreen({ setup, onFinish, onExit }: BattleScreenProps) {
  const ctrl = useBattleController(setup, onFinish);
  const { phase, queue, request, menuReady, choiceError, speed, reducedMotion } = ctrl;

  const trainer = useMemo(() => (setup.trainerId ? getTrainer(setup.trainerId) : undefined), [setup.trainerId]);
  const opponent = setup.config.opponent;
  const arena: ArenaLook = useMemo(() => {
    if (!trainer) return DEFAULT_ARENA;
    const a = ARENAS[trainer.arena];
    return a ? { name: a.name, background: a.background, fallback: a.fallback, tint: a.tint } : DEFAULT_ARENA;
  }, [trainer]);

  const factor = speedFactor(speed);
  const motionOff = reducedMotion || factor === 0;
  const cps = typewriterCps(speed, reducedMotion);

  /* ---- intro ---- */
  const introLines = useMemo(() => {
    const who = trainer ? `${trainer.title} ${trainer.name}` : opponent.name;
    return [`${who} challenges you!`, ...(trainer?.dialogue.intro ?? [])];
  }, [trainer, opponent.name]);
  const intro = useIntroSequence(introLines, {
    delay: 2500 * (factor || 0.12),
    enabled: phase === 'intro',
    onDone: ctrl.beginBattle,
  });

  useEffect(() => {
    if (phase !== 'intro') return;
    const onKey = (e: KeyboardEvent) => {
      // The viewport and the dialogue box handle Enter/Space themselves (and preventDefault): advancing
      // here as well would skip a line.
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || target.getAttribute('role') === 'button')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        intro.advance();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, intro]);

  /* ---- menus ---- */
  // Every new request starts from the action menu (state keyed by the request it belongs to).
  const [menuState, setMenuState] = useState<{ request: typeof request; menu: Menu; bag: boolean }>({ request, menu: 'action', bag: false });
  if (menuState.request !== request) setMenuState({ request, menu: 'action', bag: false });
  const menu = menuState.request === request ? menuState.menu : 'action';
  const bagOpen = menuState.request === request ? menuState.bag : false;
  const setMenu = useCallback((m: Menu) => setMenuState((s) => ({ ...s, menu: m, bag: false })), []);
  const setBagOpen = useCallback((b: boolean) => setMenuState((s) => ({ ...s, bag: b })), []);
  const [confirm, setConfirm] = useState<'forfeit' | 'exit' | null>(null);

  const activeName = queue.display.sides.p1.active?.name ?? 'your Pokémon';
  const forced = request?.kind === 'switch';
  const showMenus = phase === 'playing' && menuReady && !!request && request.kind !== 'wait';
  const partyOpen = showMenus && (forced || menu === 'party');

  const submit = useCallback(
    (choice: string) => {
      setBagOpen(false);
      ctrl.submit(choice);
    },
    [ctrl, setBagOpen],
  );

  const onViewportClick = useCallback(() => {
    if (phase === 'intro') intro.advance();
    else if (queue.busy) queue.skip();
    else if (bagOpen) setBagOpen(false);
  }, [phase, intro, queue, bagOpen, setBagOpen]);

  /* ---- dialogue text ---- */
  let dialogue: string | null = queue.text;
  let awaiting = false;
  if (phase === 'intro') {
    dialogue = intro.text;
    awaiting = true;
  } else if (showMenus) {
    if (choiceError) dialogue = choiceError;
    else if (bagOpen) dialogue = BAG_TEXT;
    else if (forced) dialogue = request.kind === 'switch' && request.reviving ? 'Choose a Pokémon to revive.' : 'Choose a Pokémon.';
    else if (menu === 'party') dialogue = 'Choose a Pokémon.';
    else if (menu === 'moves') dialogue = `Choose a move for ${activeName}.`;
    else dialogue = queue.text === RESUMED_TEXT ? `${RESUMED_TEXT}\nWhat will ${activeName} do?` : `What will ${activeName} do?`;
  }

  /* ---- result ---- */
  const resultLines = useMemo(() => {
    if (!ctrl.result || !trainer) return [];
    return ctrl.result.won ? trainer.dialogue.playerWins : trainer.dialogue.playerLoses;
  }, [ctrl.result, trainer]);

  // Leaving a finished battle still records its result (and clears the save): route through finish().
  const exitFinished = useCallback(() => ctrl.finish({ exit: true }), [ctrl]);

  const exit = useCallback(() => {
    if (!onExit) return;
    if (phase === 'ended' && ctrl.result) exitFinished();
    else if (phase === 'ended' || phase === 'loading') onExit();
    else setConfirm('exit');
  }, [onExit, phase, ctrl.result, exitFinished]);

  const style = { ['--bt-dur' as string]: String(factor || 0) };

  if (ctrl.fatal) {
    return (
      <div className="battle-screen" style={style}>
        <div className="ds-panel battle-loading p-6 text-center">
          <p className="font-display text-xs uppercase text-accent">The battle could not start</p>
          <p className="max-w-md text-sm text-muted">{ctrl.fatal}</p>
          {onExit ? (
            <button type="button" className="btn btn-primary" onClick={onExit}>
              Back
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="battle-screen" style={style} data-phase="loading">
        <div className="ds-panel battle-loading">
          <Spinner size={48} label="Loading battle…" />
          <p className="text-xs text-muted">Waking up the simulator</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('battle-screen')} data-motion={motionOff ? 'none' : 'full'} data-phase={phase} style={style}>
      <div className="relative">
        <BattleViewport
          display={queue.display}
          fx={queue.fx}
          arena={arena}
          hpDuration={queue.hpDuration}
          onClick={onViewportClick}
          label={phase === 'intro' ? 'Intro. Click to continue.' : queue.busy ? 'Battle. Click to skip the animation.' : 'Battle field'}
        >
          {phase === 'intro' ? (
            <TrainerIntroCard
              avatar={trainer?.avatar ?? opponent.avatar}
              title={trainer?.title ?? ''}
              name={trainer?.name ?? opponent.name}
              subtitle={trainer ? `${trainer.region} · ${arena.name}` : ''}
            />
          ) : null}
        </BattleViewport>
        {phase === 'ended' && ctrl.result ? (
          <ResultOverlay
            result={ctrl.result}
            opponent={{ name: trainer?.name ?? opponent.name, title: trainer?.title, avatar: trainer?.avatar ?? opponent.avatar }}
            lines={resultLines}
            cps={cps}
            onContinue={() => ctrl.finish()}
            onExit={onExit ? exitFinished : undefined}
          />
        ) : null}
      </div>

      {/* bottom screen */}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,1fr)] md:items-start" data-testid="bottom-screen">
        <DialogueBox text={dialogue} cps={cps} awaitingInput={awaiting} onAdvance={onViewportClick} className={cn(partyOpen && 'md:col-span-2')} />
        <div className={cn('min-h-[7rem]', partyOpen && 'md:col-span-2')} aria-live="off">
          {showMenus && request ? (
            request.kind === 'switch' ? (
              <div className="space-y-2">
                <PartyMenu team={request.team} forced trapped={false} reviving={request.reviving} onChoose={(slot) => submit(`switch ${slot + 1}`)} onCancel={() => undefined} />
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="menu-btn menu-btn-back !min-h-9 !px-3 !text-[0.6rem]"
                    onClick={() => setConfirm('forfeit')}
                    aria-label="Forfeit the battle"
                  >
                    Forfeit
                  </button>
                </div>
              </div>
            ) : menu === 'moves' ? (
              <MoveMenu active={request.active} onChoose={submit} onBack={() => setMenu('action')} />
            ) : menu === 'party' ? (
              <PartyMenu
                team={request.team}
                forced={false}
                trapped={request.active.trapped}
                onChoose={(slot) => submit(`switch ${slot + 1}`)}
                onCancel={() => setMenu('action')}
              />
            ) : (
              <ActionMenu
                onFight={() => {
                  ctrl.clearChoiceError();
                  setBagOpen(false);
                  setMenu('moves');
                }}
                onParty={() => {
                  ctrl.clearChoiceError();
                  setBagOpen(false);
                  setMenu('party');
                }}
                onBag={() => {
                  ctrl.clearChoiceError();
                  setBagOpen(true);
                }}
                onForfeit={() => setConfirm('forfeit')}
              />
            )
          ) : phase === 'playing' ? (
            <p className="px-2 py-3 text-center font-pixel text-lg text-muted md:text-left" aria-hidden>
              {queue.busy ? 'Click the field to skip.' : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted">
        <span>
          vs <b className="text-text">{trainer ? `${trainer.title} ${trainer.name}` : opponent.name}</b>
          {ctrl.resumed ? <span className="ml-2 chip">Resumed</span> : null}
          <span className="ml-2">Speed: {speed}</span>
        </span>
        {onExit ? (
          <button type="button" className="underline-offset-2 hover:underline" onClick={exit}>
            Exit battle
          </button>
        ) : null}
      </div>

      <Modal
        open={confirm === 'forfeit'}
        onClose={() => setConfirm(null)}
        title="Forfeit the battle?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Keep fighting
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirm(null);
                ctrl.forfeit();
              }}
            >
              Forfeit
            </button>
          </>
        }
      >
        <p className="text-sm">Giving up counts as a loss. Are you sure?</p>
      </Modal>
      <Modal
        open={confirm === 'exit'}
        onClose={() => setConfirm(null)}
        title="Leave the battle?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Stay
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirm(null);
                onExit?.();
              }}
            >
              Leave
            </button>
          </>
        }
      >
        <p className="text-sm">
          {setup.saveKey ? 'Your progress is saved; you can resume this battle later.' : 'This battle is not saved and will be lost.'}
        </p>
      </Modal>
    </div>
  );
}
