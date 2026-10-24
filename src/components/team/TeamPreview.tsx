'use client';
import { useState, type ReactNode } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import type { TeamGenSettings } from '@/lib/teams/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { PokeBall } from '@/components/ui/PokeBall';
import { cn } from '@/components/ui/cn';
import { LeadPicker } from './LeadPicker';
import { PokemonCard, PokemonCardSkeleton } from './PokemonCard';
import { TeamSettingsForm } from './TeamSettingsForm';
import { useDex } from './useDex';

export interface TeamPreviewProps {
  sets: PokemonSet[];
  /** Role labels aligned with `sets` (optional). */
  roles?: string[];
  leadIndex: number;
  onLeadChange: (index: number) => void;
  /** Shows the loading skeleton. */
  loading?: boolean;
  /** Error message; shows the error state with a retry button. */
  error?: string | null;
  onRetry?: () => void;
  /** Shows the "Reroll team" button when provided. */
  onReroll?: () => void;
  /** Shows the inline settings form when both are provided. */
  settings?: TeamGenSettings;
  onSettingsChange?: (next: TeamGenSettings) => void;
  /** Hide the level field of the settings form. */
  hideLevel?: boolean;
  /** Disables the lead picker, reroll and settings (e.g. while a battle is starting). */
  disabled?: boolean;
  title?: ReactNode;
  /** Extra actions in the ribbon row (right side). */
  actions?: ReactNode;
  /** Content under the cards (usually the Start button row). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Six {@link PokemonCard}s with lead selection, an optional reroll button and an optional inline
 * {@link TeamSettingsForm}. Shows a skeleton while loading and an error state with retry.
 */
export function TeamPreview({
  sets,
  roles,
  leadIndex,
  onLeadChange,
  loading,
  error,
  onRetry,
  onReroll,
  settings,
  onSettingsChange,
  hideLevel,
  disabled,
  title = 'Your team',
  actions,
  footer,
  className,
}: TeamPreviewProps) {
  const dex = useDex();
  const [showSettings, setShowSettings] = useState(false);
  const hasSettings = !!settings && !!onSettingsChange;
  const ready = !loading && !error && sets.length > 0;

  return (
    <Panel
      title={title}
      className={className}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {hasSettings ? (
            <Button size="sm" variant="ghost" aria-expanded={showSettings} aria-controls="team-settings" onClick={() => setShowSettings((s) => !s)} disabled={disabled}>
              {showSettings ? 'Hide settings' : 'Team settings'}
            </Button>
          ) : null}
          {onReroll ? (
            <Button size="sm" variant="secondary" onClick={onReroll} disabled={disabled || loading} loading={loading && sets.length > 0} leftIcon={<span aria-hidden>🎲</span>}>
              Reroll team
            </Button>
          ) : null}
        </div>
      }
    >
      {hasSettings && showSettings ? (
        <div id="team-settings" className="mb-4 rounded-ds border-2 border-border bg-bg/40 p-3">
          <TeamSettingsForm value={settings} onChange={onSettingsChange} disabled={disabled} hideLevel={hideLevel} />
        </div>
      ) : null}

      {ready ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">Lead</span>
            <LeadPicker sets={sets} leadIndex={leadIndex} onChange={onLeadChange} disabled={disabled} />
          </div>
          <p className="text-xs text-muted">Click a Pokémon to make it your lead.</p>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-ds border-2 border-accent/60 bg-accent/10 px-6 py-8 text-center" role="alert">
          <div className="opacity-60 grayscale">
            <PokeBall size={40} />
          </div>
          <p className="font-display text-xs uppercase">Team generation failed</p>
          <p className="max-w-md text-sm text-muted">{error}</p>
          {onRetry ? (
            <Button variant="primary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : loading || !sets.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }, (_, i) => (
            <PokemonCardSkeleton key={i} />
          ))}
          <span className="sr-only">Generating your team…</span>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Your team — choose a lead" className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3', disabled && 'pointer-events-none opacity-70')}>
          {sets.map((set, i) => (
            <PokemonCard
              key={`${set.species}-${i}`}
              set={set}
              index={i}
              isLead={i === leadIndex}
              onSelect={disabled ? undefined : onLeadChange}
              dex={dex}
              role={roles?.[i]}
              className="mt-2"
            />
          ))}
        </div>
      )}

      {footer ? <div className="mt-4 border-t-2 border-border/60 pt-4">{footer}</div> : null}
    </Panel>
  );
}
