'use client';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PokemonSet } from '@pkmn/sim';
import { TRAINERS, getTrainer } from '@/data/trainers';
import { DEFAULT_FORMAT, GEN9_ONLY_FORMAT, type BattleResult, type BattleSetup } from '@/lib/battle/types';
import { buildBattleSetup, type DifficultyChoice } from '@/lib/game/results';
import { reorderLead, type TeamGenSettings } from '@/lib/teams';
import { clearSavedBattle, recordBattleResult, type SavedBattle } from '@/lib/storage';
import { useHydrated, useSettings, useStats } from '@/lib/storage/useStorage';
import { randomSeed } from '@/lib/util/seed';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { cn } from '@/components/ui/cn';
import { TeamPreview, TeamSettingsForm, useGeneratedTeam } from '@/components/team';
import type { BattleFinishMeta } from '@/components/battle';
import { BattleHost, DifficultyPicker, ModeHeader, OpponentCard, ResultCard, ResumeBanner, Steps, useSavedBattle } from '@/components/modes';

type Step = 'form' | 'preview' | 'battle' | 'result';

const STEP_LABELS = ['Settings', 'Team', 'Battle', 'Result'];
const STEP_INDEX: Record<Step, number> = { form: 0, preview: 1, battle: 2, result: 3 };
const SAVE_KEY = 'custom';

export const FORMAT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: DEFAULT_FORMAT, label: 'National Dex', hint: 'Every Pokémon from all generations. Mega Evolution and Z-Moves allowed.' },
  { value: GEN9_ONLY_FORMAT, label: 'Gen 9 only (no Megas / Z-Moves)', hint: 'Scarlet & Violet rules: no Mega Evolution, no Z-Moves.' },
];

function newTeamSeed(): string {
  return `custom-${randomSeed()}`;
}

function validTrainerId(id: string | null): string | null {
  return id && getTrainer(id) ? id : null;
}

/**
 * Custom Battle: every knob exposed — opponent, generation pool, level, randomization mode, AI
 * difficulty, legendaries and format — then the team preview and the battle.
 */
export function CustomBattle() {
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const settings = useSettings();
  const stats = useStats();
  const queryTrainer = validTrainerId(searchParams.get('trainer'));

  const [step, setStep] = useState<Step>('form');
  const [trainerId, setTrainerId] = useState<string>(queryTrainer ?? TRAINERS[0].id);
  const [teamSettings, setTeamSettings] = useState<TeamGenSettings | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyChoice | null>(null);
  const [formatid, setFormatid] = useState<string>(DEFAULT_FORMAT);
  const [teamSeed, setTeamSeed] = useState<string | null>(null);
  const [leadIndex, setLeadIndex] = useState(0);
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [lastTeam, setLastTeam] = useState<PokemonSet[] | null>(null);

  const [syncedQuery, setSyncedQuery] = useState(queryTrainer);
  if (queryTrainer !== syncedQuery) {
    setSyncedQuery(queryTrainer);
    if (queryTrainer && queryTrainer !== trainerId && step === 'form') setTrainerId(queryTrainer);
  }

  const effectiveSettings = teamSettings ?? settings.teamSettings;
  const effectiveDifficulty = difficulty ?? settings.difficulty;
  const trainer = getTrainer(trainerId) ?? TRAINERS[0];
  const saved = useSavedBattle(SAVE_KEY);

  const genSeed = hydrated && step === 'preview' ? teamSeed : null;
  const team = useGeneratedTeam(genSeed ? effectiveSettings : null, genSeed);

  const trainerOptions = useMemo(
    () => TRAINERS.map((t) => ({ value: t.id, label: `${t.title} ${t.name} · ${'★'.repeat(t.difficulty)}` })),
    [],
  );

  const goToPreview = useCallback(() => {
    setTeamSeed(newTeamSeed());
    setLeadIndex(0);
    setResult(null);
    setStep('preview');
  }, []);

  const reroll = useCallback(() => {
    setTeamSeed(newTeamSeed());
    setLeadIndex(0);
  }, []);

  const changeSettings = useCallback((next: TeamGenSettings) => {
    setTeamSettings(next);
    setLeadIndex(0);
  }, []);

  const startBattle = useCallback(
    (playerTeam: PokemonSet[]) => {
      const next = buildBattleSetup({
        mode: 'custom',
        saveKey: SAVE_KEY,
        trainer,
        playerName: settings.playerName,
        playerTeam,
        level: effectiveSettings.level,
        difficulty: effectiveDifficulty,
        seed: randomSeed(),
        formatid,
      });
      setLastTeam(next.config.player.team);
      setSetup(next);
      setResult(null);
      setStep('battle');
    },
    [trainer, settings.playerName, effectiveSettings.level, effectiveDifficulty, formatid],
  );

  const startFromPreview = useCallback(() => {
    if (!team.sets.length) return;
    startBattle(reorderLead(team.sets, leadIndex));
  }, [team.sets, leadIndex, startBattle]);

  const resume = useCallback((s: SavedBattle) => {
    if (s.setup.trainerId) setTrainerId(s.setup.trainerId);
    if (s.setup.config.formatid) setFormatid(s.setup.config.formatid);
    setLastTeam(s.setup.config.player.team);
    setSetup(s.setup);
    setResult(null);
    setStep('battle');
  }, []);

  const onFinish = useCallback((r: BattleResult, meta?: BattleFinishMeta) => {
    recordBattleResult(r);
    clearSavedBattle(SAVE_KEY);
    if (r.trainerId) setTrainerId(r.trainerId);
    setResult(r);
    if (meta?.exit) {
      setSetup(null);
      setStep('preview');
    } else {
      setStep('result');
    }
  }, []);

  const onExit = useCallback(() => {
    setSetup(null);
    setStep('preview');
  }, []);

  if (step === 'battle' && setup) {
    return (
      <div className="space-y-4">
        <Steps steps={STEP_LABELS} current={STEP_INDEX.battle} />
        <BattleHost setup={setup} onFinish={onFinish} onExit={onExit} />
      </div>
    );
  }

  if (step === 'result' && result) {
    const resultTrainer = (result.trainerId && getTrainer(result.trainerId)) || trainer;
    return (
      <div className="space-y-6">
        <ModeHeader kicker="Custom Battle" title={result.won ? 'Victory!' : 'Defeat'} description={`${resultTrainer.title} ${resultTrainer.name} · ${result.turns} turns`} />
        <Steps steps={STEP_LABELS} current={STEP_INDEX.result} />
        <ResultCard
          result={result}
          trainer={resultTrainer}
          actions={
            <>
              <Button variant="primary" onClick={goToPreview}>
                Battle again (new team)
              </Button>
              {lastTeam ? (
                <Button variant="secondary" onClick={() => startBattle(lastTeam)}>
                  Rematch (same team)
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => { setResult(null); setStep('form'); }}>
                Change settings
              </Button>
            </>
          }
        />
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <ModeHeader
          kicker="Custom Battle"
          title={`vs ${trainer.name}`}
          description={`${FORMAT_OPTIONS.find((f) => f.value === formatid)?.label ?? 'National Dex'} · level ${effectiveSettings.level} · ${effectiveSettings.mode} · AI ${effectiveDifficulty === 'trainer' ? `trainer default` : effectiveDifficulty}`}
          aside={
            <Button variant="ghost" onClick={() => setStep('form')}>
              ← Back to settings
            </Button>
          }
        />
        <Steps steps={STEP_LABELS} current={STEP_INDEX.preview} />
        {saved ? <ResumeBanner saved={saved} onResume={resume} /> : null}
        <OpponentCard trainer={trainer} kicker="Your opponent" wins={stats.trainersDefeated[trainer.id]} />
        <TeamPreview
          sets={team.sets}
          roles={team.roles}
          leadIndex={leadIndex}
          onLeadChange={setLeadIndex}
          loading={team.loading || !hydrated}
          error={team.error}
          onRetry={team.retry}
          onReroll={reroll}
          settings={effectiveSettings}
          onSettingsChange={changeSettings}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="primary" size="xl" onClick={startFromPreview} disabled={team.loading || !team.sets.length || !!team.error}>
                Start Battle
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModeHeader kicker="Custom Battle" title="Set up your battle" description="Every setting exposed. Nothing here affects your daily streak or your default settings." />
      <Steps steps={STEP_LABELS} current={STEP_INDEX.form} />
      {saved ? <ResumeBanner saved={saved} onResume={resume} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Opponent" light className="lg:col-span-2">
          <div className="space-y-4">
            <Select label="Trainer" options={trainerOptions} value={trainer.id} onChange={setTrainerId} className="max-w-md" />
            <OpponentCard trainer={trainer} wins={stats.trainersDefeated[trainer.id]} />
          </div>
        </Panel>
        <Panel title="Your team" light>
          {hydrated ? <TeamSettingsForm value={effectiveSettings} onChange={changeSettings} /> : <p className="text-sm text-muted">Loading your defaults…</p>}
        </Panel>
        <Panel title="Battle rules" light>
          <div className="space-y-5">
            <DifficultyPicker value={effectiveDifficulty} onChange={setDifficulty} trainer={trainer} />
            <div className="space-y-1.5">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-muted">Format</span>
              <div role="radiogroup" aria-label="Battle format" className="flex flex-wrap gap-1.5">
                {FORMAT_OPTIONS.map((f) => {
                  const active = f.value === formatid;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFormatid(f.value)}
                      title={f.hint}
                      className={cn('chip cursor-pointer transition-colors hover:border-border-light', active && 'border-[#a6e8ff] bg-blue text-[#0b1a2a]')}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">{FORMAT_OPTIONS.find((f) => f.value === formatid)?.hint}</p>
              <p className="font-pixel text-base leading-none text-muted">{formatid}</p>
            </div>
          </div>
        </Panel>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="xl" onClick={goToPreview} disabled={!hydrated}>
          Generate team →
        </Button>
      </div>
    </div>
  );
}
