'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrainer } from '@/data/trainers';
import type { Trainer } from '@/data/trainers/types';
import { getDailyInfo, msUntilNextDaily } from '@/lib/game/daily';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Stars } from '@/components/ui/Stars';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';

/**
 * "TODAY'S CHALLENGER" featured card. The trainer is computed on the client after
 * mount (UTC date) so the server and client can never disagree on the date.
 */
export function TodaysChallenger() {
  const [daily, setDaily] = useState<{ trainer: Trainer; date: string } | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
      const info = getDailyInfo();
      const trainer = getTrainer(info.trainerId);
      if (trainer) setDaily((prev) => (prev?.date === info.date ? prev : { trainer, date: info.date }));
      setCountdown(formatCountdown(msUntilNextDaily()));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Panel title="Today's challenger" light scanlines className="animate-fade-up [animation-delay:240ms]">
      {daily ? (
        <ChallengerBody trainer={daily.trainer} date={daily.date} countdown={countdown} />
      ) : (
        <Skeleton />
      )}
    </Panel>
  );
}

function ChallengerBody({ trainer, date, countdown }: { trainer: Trainer; date: string; countdown: string }) {
  return (
    <div className="relative z-[2] grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
      <div className="flex items-center gap-4 md:block">
        <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={120} className="animate-pop-in" />
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-muted">
          {trainer.title} · {trainer.region}
        </p>
        <h3 className="mt-1 font-display text-sm uppercase leading-relaxed sm:text-lg">
          <Link href={`/trainers/${trainer.id}`} className="hover:text-yellow">
            {trainer.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{trainer.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Stars value={trainer.difficulty} size={16} />
          <Badge tone="outline">{date} UTC</Badge>
          {countdown ? (
            <span className="font-pixel text-lg leading-none text-muted" title="Time until the next daily challenge">
              Next in {countdown}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded border border-border bg-bg/60 p-0.5">
            <PokemonSprite species={trainer.signature} variant="menu" size={56} />
          </span>
          <span>
            <span className="block text-[0.6rem] font-extrabold uppercase tracking-wider text-muted">Signature Pokémon</span>
            <span className="font-bold">{trainer.signature}</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:min-w-56">
        <Button href="/daily" variant="primary" size="xl" block>
          Start daily battle
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button href="/battle" variant="secondary" size="sm" block>
            Free Battle
          </Button>
          <Button href="/boss-rush" variant="ghost" size="sm" block>
            Boss Rush
          </Button>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="relative z-[2] grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center" aria-busy="true" aria-live="polite">
      <div className="shine size-[120px] rounded-ds" />
      <div className="space-y-3">
        <div className="shine h-3 w-32 rounded" />
        <div className="shine h-6 w-56 rounded" />
        <div className="shine h-3 w-72 max-w-full rounded" />
        <div className="shine h-10 w-40 rounded" />
      </div>
      <div className="shine h-14 w-full rounded-ds md:w-56" />
      <span className="sr-only">Loading today&apos;s challenger…</span>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
