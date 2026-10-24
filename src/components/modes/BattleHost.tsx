'use client';
import { useEffect, useRef } from 'react';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import { BattleScreen } from '@/components/battle/BattleScreen';
import type { BattleFinishMeta } from '@/components/battle/useBattleController';

export interface BattleHostProps {
  setup: BattleSetup;
  /** Called exactly once per battle (Continue and Exit both record the result); `meta.exit` tells them apart. */
  onFinish: (result: BattleResult, meta: BattleFinishMeta) => void;
  /** Leaving an unfinished battle (its save is kept). */
  onExit?: () => void;
}

/**
 * The one place the game modes mount the battle screen. Keeps the battle UI import in a single file.
 */
export function BattleHost({ setup, onFinish, onExit }: BattleHostProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The battle usually mounts below the team step; bring it into view once so the field is never off-screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > 120) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, []);

  return (
    <div ref={ref} className="w-full scroll-mt-20" data-mode={setup.mode} data-save-key={setup.saveKey ?? undefined}>
      <BattleScreen setup={setup} onFinish={onFinish} onExit={onExit} />
    </div>
  );
}
