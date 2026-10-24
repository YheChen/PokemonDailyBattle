'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTrainer } from '@/data/trainers';
import { STORAGE_KEYS, clearSavedBattle, getSavedBattle, migrateLegacyBattleSave, type SavedBattle } from '@/lib/storage';
import { useHydrated, useStorageRaw } from '@/lib/storage/useStorage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';

/**
 * The saved in-progress battle stored under `saveKey`, reactive to storage changes. `null` on the
 * server, before hydration, without a key, and when nothing is saved under that key.
 */
export function useSavedBattle(saveKey: string | null | undefined): SavedBattle | null {
  const hydrated = useHydrated();
  // Saves written before per-key slots existed live under pc:battle:current; move them once on the client.
  useEffect(() => {
    if (hydrated) migrateLegacyBattleSave();
  }, [hydrated]);
  const raw = useStorageRaw(STORAGE_KEYS.battle(saveKey || 'none'));
  return useMemo(() => (hydrated && saveKey && raw != null ? getSavedBattle(saveKey) : null), [hydrated, raw, saveKey]);
}

export interface ResumeBannerProps {
  saved: SavedBattle;
  onResume: (saved: SavedBattle) => void;
  /** Called after the saved battle was removed from storage. */
  onDiscard?: (saved: SavedBattle) => void;
  /** Label of the discard button (default "Discard"). */
  discardLabel?: string;
  /** When set, discarding asks for confirmation with this warning (e.g. "counts as a loss"). */
  discardWarning?: string;
  className?: string;
}

/** "You have a battle in progress" banner with Resume / Discard. */
export function ResumeBanner({ saved, onResume, onDiscard, discardLabel = 'Discard', discardWarning, className }: ResumeBannerProps) {
  const trainer = saved.setup.trainerId ? getTrainer(saved.setup.trainerId) : undefined;
  const opponent = saved.setup.config.opponent;
  const turns = useMemo(() => saved.serialized.inputLog.filter((l) => l.startsWith('>p1 ')).length, [saved]);
  const [confirm, setConfirm] = useState(false);

  const discard = useCallback(() => {
    setConfirm(false);
    clearSavedBattle(saved.setup.saveKey);
    onDiscard?.(saved);
  }, [onDiscard, saved]);

  return (
    <div className={cn('ds-panel-light flex flex-wrap items-center gap-4 p-4', className)} role="region" aria-label="Battle in progress">
      {trainer ? <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={56} /> : null}
      <div className="min-w-0 flex-1">
        <p className="font-display text-[0.65rem] uppercase text-yellow">Battle in progress</p>
        <p className="mt-1 text-sm">
          vs <span className="font-extrabold">{trainer ? `${trainer.title} ${trainer.name}` : opponent.name}</span>
          {turns ? <span className="text-muted"> · {turns} {turns === 1 ? 'action' : 'actions'} played</span> : null}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => onResume(saved)}>
          Resume battle
        </Button>
        <Button variant="ghost" onClick={() => (discardWarning ? setConfirm(true) : discard())}>
          {discardLabel}
        </Button>
      </div>
      {discardWarning ? (
        <Modal
          open={confirm}
          onClose={() => setConfirm(false)}
          title={`${discardLabel}?`}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep the battle
              </Button>
              <Button variant="danger" onClick={discard}>
                {discardLabel}
              </Button>
            </>
          }
        >
          <p className="text-sm">{discardWarning}</p>
        </Modal>
      ) : null}
    </div>
  );
}
