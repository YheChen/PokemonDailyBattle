'use client';
import { useState } from 'react';
import type { Trainer } from '@/data/trainers/types';
import { ARENAS } from '@/data/trainers/arenas';
import { assets } from '@/lib/assets/provider';
import { useHydrated, useStats } from '@/lib/storage/useStorage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Stars } from '@/components/ui/Stars';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { TrainerTeam } from './TrainerTeam';

export interface TrainerDetailProps {
  trainer: Trainer;
}

const AI_LABEL: Record<Trainer['ai'], string> = { normal: 'Normal', hard: 'Hard', champion: 'Champion' };

/**
 * Full trainer page: arena hero, bio, team, dialogue preview, the player's record and battle buttons.
 */
export function TrainerDetail({ trainer }: TrainerDetailProps) {
  const arena = ARENAS[trainer.arena];
  const battleHref = `/battle?trainer=${encodeURIComponent(trainer.id)}`;
  const customHref = `/custom?trainer=${encodeURIComponent(trainer.id)}`;

  return (
    <div className="space-y-8">
      <ArenaHero trainer={trainer} arenaName={arena.name} background={arena.background} fallback={arena.fallback} tint={arena.tint} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Profile">
            <p className="text-sm leading-relaxed">{trainer.bio}</p>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <Row label="Region">{trainer.region}</Row>
              <Row label="Arena">{arena.name}</Row>
              <Row label="Team source">{trainer.source}</Row>
              <Row label="Default AI">{AI_LABEL[trainer.ai]}</Row>
              <Row label="Signature">
                <span className="inline-flex items-center gap-1.5">
                  <PokemonSprite species={trainer.signature} variant="icon" />
                  {trainer.signature}
                </span>
              </Row>
              <Row label="Difficulty">
                <Stars value={trainer.difficulty} size={12} />
              </Row>
            </dl>
          </Panel>

          <Panel title="Team">
            <TrainerTeam team={trainer.team} canonical={trainer.canonical} teamNotes={trainer.teamNotes} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Your record">
            <Record trainerId={trainer.id} name={trainer.name} />
          </Panel>

          <Panel title="Before the battle">
            <ol className="space-y-2">
              {trainer.dialogue.intro.map((line, i) => (
                <li key={i} className="rounded-ds border-2 border-border bg-bg/60 px-3 py-2 font-pixel text-xl leading-tight">
                  {line}
                </li>
              ))}
            </ol>
          </Panel>

          <div className="flex flex-col gap-3">
            <Button href={battleHref} variant="primary" size="lg" block>
              Battle {trainer.name}
            </Button>
            <Button href={customHref} variant="secondary" block>
              Custom challenge
            </Button>
            <Button href="/trainers" variant="ghost" block>
              All trainers
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 font-extrabold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ArenaHero({
  trainer,
  arenaName,
  background,
  fallback,
  tint,
}: {
  trainer: Trainer;
  arenaName: string;
  background: string;
  fallback: string;
  tint?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = assets.arenaBackground(background);
  return (
    <section
      className="ds-panel relative overflow-hidden p-0"
      style={{ ['--accent' as string]: trainer.accent }}
      aria-label={`${trainer.name} at ${arenaName}`}
    >
      <div className="absolute inset-0" style={{ background: fallback }} aria-hidden>
        {!imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="sprite size-full object-cover opacity-90"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {tint ? <div className="absolute inset-0" style={{ background: tint }} /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
      </div>

      <div className="relative z-[1] flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-8">
        <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={128} className="shrink-0 shadow-ds" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-yellow">{trainer.title}</p>
          <h1 className="mt-1 font-display text-lg uppercase leading-relaxed sm:text-2xl">{trainer.name}</h1>
          <p className="text-sm text-muted sm:text-base">{trainer.subtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="outline">{trainer.region}</Badge>
            <Badge tone="outline">{arenaName}</Badge>
            <Stars value={trainer.difficulty} size={14} />
          </div>
        </div>
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: trainer.accent }} />
    </section>
  );
}

function Record({ trainerId, name }: { trainerId: string; name: string }) {
  const hydrated = useHydrated();
  const stats = useStats();
  if (!hydrated) {
    return <p className="font-pixel text-xl text-muted">Loading your record…</p>;
  }
  const wins = stats.trainersDefeated[trainerId] ?? 0;
  const fights = stats.history.filter((h) => h.trainerId === trainerId);
  const losses = fights.filter((h) => !h.won).length;
  const last = fights[0];

  if (wins === 0 && fights.length === 0) {
    return (
      <p className="font-pixel text-xl leading-tight text-muted">
        You haven&apos;t battled {name} yet. Challenge them to start your record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Wins" value={wins} tone="text-green" />
        <Tile label="Losses" value={losses} tone="text-accent" />
      </div>
      {last ? (
        <p className="text-xs text-muted">
          Last battle: <span className={last.won ? 'font-extrabold text-green' : 'font-extrabold text-accent'}>{last.won ? 'Won' : 'Lost'}</span>{' '}
          in {last.turns} {last.turns === 1 ? 'turn' : 'turns'} on {new Date(last.finishedAt).toLocaleDateString()}.
        </p>
      ) : (
        <p className="text-xs text-muted">Wins recorded before battle history was kept.</p>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-center rounded-ds border-2 border-border bg-bg/60 px-2 py-3 text-center">
      <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">{label}</span>
      <span className={`font-display text-xl ${tone}`}>{value}</span>
    </div>
  );
}
