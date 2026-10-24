'use client';
import { DEFAULT_SETTINGS, updateSettings } from '@/lib/storage';
import type { BattleSpeed, UserSettings } from '@/lib/storage/types';
import { useHydrated, useSettings } from '@/lib/storage/useStorage';
import { DEFAULT_TEAM_SETTINGS } from '@/lib/teams/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/components/ui/cn';
import { AssetInfo } from './AssetInfo';
import { DangerZone } from './DangerZone';
import { TeamSettingsFields } from './TeamSettingsFields';

type DifficultySetting = UserSettings['difficulty'];

const SPEED_OPTIONS: { value: BattleSpeed; label: string; hint: string }[] = [
  { value: 'normal', label: 'Normal', hint: 'Full animations and dialogue pacing' },
  { value: 'fast', label: 'Fast', hint: 'Shorter animations' },
  { value: 'instant', label: 'Instant', hint: 'Skip animations entirely' },
];

const DIFFICULTY_OPTIONS: { value: DifficultySetting; label: string }[] = [
  { value: 'trainer', label: 'Trainer default (by star rating)' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
  { value: 'champion', label: 'Champion' },
];

const RENDER_MODE_LABELS: Record<UserSettings['renderMode'], string> = {
  classic: 'Classic — Gen 5 animated sprites',
  modern: 'Modern',
};

/**
 * The whole /settings page body. Every control writes straight to `pc:settings` through `updateSettings`
 * and re-renders through `useSettings`, so other tabs/pages see the change immediately.
 */
export function SettingsForm() {
  const hydrated = useHydrated();
  const settings = useSettings();

  if (!hydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading settings" />
      </div>
    );
  }

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => updateSettings({ [key]: value });

  return (
    <div className="space-y-8">
      <Panel title="Player">
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor="player-name" className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Player name
          </label>
          <input
            id="player-name"
            type="text"
            value={settings.playerName}
            maxLength={18}
            autoComplete="nickname"
            onChange={(e) => set('playerName', e.target.value)}
            onBlur={(e) => {
              if (e.target.value.trim() === '') set('playerName', DEFAULT_SETTINGS.playerName);
            }}
            className="w-full rounded-ds border-2 border-border bg-surface-2 px-3 py-2 text-sm font-bold text-text shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] hover:border-border-light"
          />
          <p className="text-xs text-muted">Shown in battle dialogue and on your result cards. Up to 18 characters.</p>
        </div>
      </Panel>

      <Panel title="Battle">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Battle speed</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Battle speed">
              {SPEED_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  selected={settings.battleSpeed === o.value}
                  onSelect={() => set('battleSpeed', o.value)}
                />
              ))}
            </div>
          </fieldset>

          <Select<DifficultySetting>
            label="Default AI difficulty"
            hint="Used by Free Battle. Daily and Boss Rush always use each trainer's own rating."
            value={settings.difficulty}
            onChange={(v) => set('difficulty', v)}
            options={DIFFICULTY_OPTIONS}
            className="sm:max-w-md"
          />
        </div>
      </Panel>

      <Panel
        title="Default team"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set('teamSettings', { ...DEFAULT_TEAM_SETTINGS })}
            disabled={JSON.stringify(settings.teamSettings) === JSON.stringify(DEFAULT_TEAM_SETTINGS)}
          >
            Reset to default
          </Button>
        }
      >
        <p className="mb-4 text-xs text-muted">
          How your six random Pokémon are generated in Free Battle and Boss Rush. The Daily Challenge always uses the
          default settings so everyone gets the same team.
        </p>
        <TeamSettingsFields value={settings.teamSettings} onChange={(teamSettings) => set('teamSettings', teamSettings)} />
      </Panel>

      <Panel title="Display">
        <div className="space-y-6">
          <Toggle
            label="Reduced motion"
            description="Turn off attack animations and screen shakes. Your system's reduce-motion preference is always respected."
            checked={settings.reducedMotion}
            onChange={(v) => set('reducedMotion', v)}
          />
          <div className="space-y-1">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-muted">Render mode</span>
            <p className="text-sm font-extrabold">{RENDER_MODE_LABELS[settings.renderMode] ?? RENDER_MODE_LABELS.classic}</p>
            <p className="text-xs text-muted">Battle sprites come from Pokémon Showdown&apos;s animated Gen 5 set.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Assets">
        <AssetInfo />
      </Panel>

      <Panel title="Danger zone">
        <DangerZone />
      </Panel>
    </div>
  );
}

function OptionCard({ label, hint, selected, onSelect }: { label: string; hint: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-ds border-2 px-3 py-2 text-left transition-colors',
        selected ? 'border-yellow bg-yellow/10' : 'border-border bg-bg/50 hover:border-border-light',
      )}
    >
      <span className="text-sm font-extrabold">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}
