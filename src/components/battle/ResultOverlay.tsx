'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { BattleResult } from '@/lib/battle/types';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';
import { DialogueBox } from './DialogueBox';

export interface ResultOverlayProps {
  result: BattleResult;
  opponent: { name: string; title?: string; avatar?: string };
  /** Trainer lines for this outcome, shown one by one. */
  lines: readonly string[];
  cps: number;
  onContinue: () => void;
  onExit?: () => void;
}

const MODE_LABELS: Record<BattleResult['mode'], string> = {
  daily: 'Daily Challenge',
  free: 'Free Battle',
  'boss-rush': 'Boss Rush',
  custom: 'Custom Battle',
};

/** "YOU WON!" / "YOU LOST…" panel with the trainer's reaction, a summary and the Continue button. */
export function ResultOverlay({ result, opponent, lines, cps, onContinue, onExit }: ResultOverlayProps) {
  const [line, setLine] = useState(0);
  const finished = line >= lines.length;
  const continueRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keyboard users: take focus as soon as the overlay appears (the trainer's lines advance with
  // Enter/Space on the dialogue box), then land on Continue once the summary is shown.
  useEffect(() => {
    if (finished) {
      continueRef.current?.focus({ preventScroll: true });
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const dialogue = panel.querySelector<HTMLElement>('[role="button"]');
    (dialogue ?? panel).focus({ preventScroll: true });
  }, [finished]);

  // Keep Tab inside the dialog (the viewport behind it is focusable).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [role="button"], [tabindex]:not([tabindex="-1"])'),
    );
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || !panelRef.current.contains(current))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (current === last || !panelRef.current.contains(current))) {
      e.preventDefault();
      first.focus();
    }
  };

  const banner = result.forfeited ? 'YOU GAVE UP' : result.won ? 'YOU WON!' : 'YOU LOST…';
  const label = opponent.title ? `${opponent.title} ${opponent.name}` : opponent.name;

  return (
    <div className="result-overlay" role="dialog" aria-modal="true" aria-label="Battle result" onKeyDown={onKeyDown}>
      <div ref={panelRef} tabIndex={-1} className="ds-panel-light mx-4 w-full max-w-md p-4 text-center outline-none sm:p-5">
        <div className={cn('result-banner', result.won ? 'result-won' : 'result-lost')}>{banner}</div>
        <div className="mt-3 flex items-center justify-center gap-3">
          {opponent.avatar ? <TrainerPortrait avatar={opponent.avatar} name={opponent.name} size={64} /> : null}
          <div className="text-left">
            <div className="font-display text-[0.6rem] uppercase text-yellow">{result.won ? 'Defeated' : 'Victor'}</div>
            <div className="font-extrabold">{label}</div>
          </div>
        </div>

        {!finished && lines.length ? (
          <div className="mt-3">
            <DialogueBox text={lines[line]} cps={cps} awaitingInput onAdvance={() => setLine((l) => l + 1)} className="text-base sm:text-lg" />
          </div>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-left text-sm">
              <dt className="text-muted">Turns</dt>
              <dd className="font-extrabold">{result.turns}</dd>
              <dt className="text-muted">Your Pokémon left</dt>
              <dd className="font-extrabold">{result.playerRemaining} / {result.playerTeamStatus.length}</dd>
              <dt className="text-muted">Opponent left</dt>
              <dd className="font-extrabold">{result.opponentRemaining} / {result.opponentTeamStatus.length}</dd>
              <dt className="text-muted">Mode</dt>
              <dd className="font-extrabold">{MODE_LABELS[result.mode]}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xl" aria-label="Your team">
              {result.playerTeamStatus.map((p, i) => (
                <span key={i} title={`${p.species}${p.fainted ? ' (fainted)' : ''}`} aria-hidden>
                  {p.fainted ? '🔴' : '🟢'}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button ref={continueRef} type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
                Continue
              </button>
              {onExit ? (
                <button type="button" className="btn btn-ghost" onClick={onExit}>
                  Exit
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
