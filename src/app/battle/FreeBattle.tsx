'use client';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PokemonSet } from '@pkmn/sim';
import { getTrainer } from '@/data/trainers';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import { buildBattleSetup, type DifficultyChoice } from '@/lib/game/results';
import { reorderLead, type BattleLevel, type TeamGenSettings } from '@/lib/teams';
import { clearSavedBattle, recordBattleResult, type SavedBattle } from '@/lib/storage';
import { useHydrated, useSettings, useStats } from '@/lib/storage/useStorage';
import { randomSeed } from '@/lib/util/seed';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TeamPreview, useGeneratedTeam } from '@/components/team';
import type { BattleFinishMeta } from '@/components/battle';
import {
  BattleHost,
  DifficultyPicker,
  ModeHeader,
  OpponentCard,
  ResultCard,
  ResumeBanner,
  Steps,
  TrainerPicker,
  useSavedBattle,
} from '@/components/modes';

type Step = 'pick' | 'preview' | 'battle' | 'result';

const STEP_LABELS = ['Opponent', 'Team', 'Battle', 'Result'];
const STEP_INDEX: Record<Step, number> = { pick: 0, preview: 1, battle: 2, result: 3 };
const SAVE_KEY = 'free';

/** A fresh team seed (free battles are never deterministic). */
function newTeamSeed(): string {
  return `free-${randomSeed()}`;
}

function validTrainerId(id: string | null): string | null {
  return id && getTrainer(id) ? id : null;
}

/**
 * Free Battle: pick a trainer (preselected from `?trainer=`), generate a team (reroll + settings),
 * choose the lead and AI difficulty, battle, then see the result with rematch options.
 */
export function FreeBattle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const settings = useSettings();
  const stats = useStats();
  const queryTrainer = validTrainerId(searchParams.get('trainer'));

  const [trainerId, setTrainerId] = useState<string | null>(queryTrainer);
  const [step, setStep] = useState<Step>(queryTrainer ? 'preview' : 'pick');
  const [teamSeed, setTeamSeed] = useState<string | null>(() => (queryTrainer ? newTeamSeed() : null));
  const [leadIndex, setLeadIndex] = useState(0);
  const [teamSettings, setTeamSettings] = useState<TeamGenSettings | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyChoice | null>(null);
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [lastTeam, setLastTeam] = useState<PokemonSet[] | null>(null);

  // React to the `?trainer=` query changing after mount (e.g. a card on another page linking here).
  const [syncedQuery, setSyncedQuery] = useState(queryTrainer);
  if (queryTrainer !== syncedQuery) {
    setSyncedQuery(queryTrainer);
    if (queryTrainer && queryTrainer !== trainerId && step !== 'battle') {
      setTrainerId(queryTrainer);
      setStep('preview');
      setTeamSeed(newTeamSeed());
      setLeadIndex(0);
      setResult(null);
    }
  }

  const effectiveSettings = teamSettings ?? settings.teamSettings;
  const effectiveDifficulty = difficulty ?? settings.difficulty;
  const trainer = trainerId ? getTrainer(trainerId) ?? null : null;
  const saved = useSavedBattle(SAVE_KEY);

  // Generate only on the client once settings are readable, and only on the team step.
  const genSeed = hydrated && step === 'preview' ? teamSeed : null;
  const team = useGeneratedTeam(genSeed ? effectiveSettings : null, genSeed);

  const selectTrainer = useCallback(
    (id: string) => {
      setTrainerId(id);
      router.replace(`/battle?trainer=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router],
  );

  const goToPreview = useCallback(() => {
    if (!trainerId) return;
    if (!teamSeed) setTeamSeed(newTeamSeed());
    setResult(null);
    setStep('preview');
  }, [trainerId, teamSeed]);

  const reroll = useCallback(() => {
    setTeamSeed(newTeamSeed());
    setLeadIndex(0);
  }, []);

  const changeSettings = useCallback((next: TeamGenSettings) => {
    setTeamSettings(next);
    setLeadIndex(0);
  }, []);

  const startBattle = useCallback(
    (playerTeam: PokemonSet[], level: BattleLevel) => {
      if (!trainer) return;
      const next = buildBattleSetup({
        mode: 'free',
        saveKey: SAVE_KEY,
        trainer,
        playerName: settings.playerName,
        playerTeam,
        level,
        difficulty: effectiveDifficulty,
        seed: randomSeed(),
      });
      setLastTeam(next.config.player.team);
      setSetup(next);
      setResult(null);
      setStep('battle');
    },
    [trainer, settings.playerName, effectiveDifficulty],
  );

  const startFromPreview = useCallback(() => {
    if (!team.sets.length) return;
    startBattle(reorderLead(team.sets, leadIndex), effectiveSettings.level);
  }, [team.sets, leadIndex, startBattle, effectiveSettings.level]);

  const resume = useCallback((s: SavedBattle) => {
    if (s.setup.trainerId) setTrainerId(s.setup.trainerId);
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
      // Exit on the result overlay: the result is recorded above; skip the result card.
      setSetup(null);
      setStep(r.trainerId ? 'preview' : 'pick');
    } else {
      setStep('result');
    }
  }, []);

  const onExit = useCallback(() => {
    setSetup(null);
    setStep(trainerId ? 'preview' : 'pick');
  }, [trainerId]);

  const wins = stats.trainersDefeated;
  const resultTrainer = useMemo(() => (result?.trainerId ? getTrainer(result.trainerId) ?? trainer : trainer), [result, trainer]);

  if (step === 'battle' && setup) {
    return (
      <div className="space-y-4">
        <Steps steps={STEP_LABELS} current={STEP_INDEX.battle} />
        <BattleHost setup={setup} onFinish={onFinish} onExit={onExit} />
      </div>
    );
  }

  if (step === 'result' && result && resultTrainer) {
    return (
      <div className="space-y-6">
        <ModeHeader kicker="Free Battle" title={result.won ? 'Victory!' : 'Defeat'} description={`${resultTrainer.title} ${resultTrainer.name} · ${result.turns} turns`} />
        <Steps steps={STEP_LABELS} current={STEP_INDEX.result} />
        <ResultCard
          result={result}
          trainer={resultTrainer}
          actions={
            <>
              <Button variant="primary" onClick={() => { setTrainerId(resultTrainer.id); setTeamSeed(newTeamSeed()); setLeadIndex(0); setResult(null); setStep('preview'); }}>
                Battle again (new team)
              </Button>
              {lastTeam ? (
                <Button variant="secondary" onClick={() => { setTrainerId(resultTrainer.id); startBattle(lastTeam, lastTeam[0]?.level === 50 ? 50 : 100); }}>
                  Rematch (same team)
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => { setResult(null); setStep('pick'); }}>
                Choose another trainer
              </Button>
            </>
          }
        />
      </div>
    );
  }

  if (step === 'preview' && trainer) {
    return (
      <div className="space-y-6">
        <ModeHeader
          kicker="Free Battle"
          title={`vs ${trainer.name}`}
          description="Generate a team, pick your lead and the AI difficulty, then start the battle. Free battles don't affect your daily streak."
          aside={
            <Button variant="ghost" onClick={() => setStep('pick')}>
              ← Change trainer
            </Button>
          }
        />
        <Steps steps={STEP_LABELS} current={STEP_INDEX.preview} />
        {saved ? <ResumeBanner saved={saved} onResume={resume} /> : null}
        <OpponentCard trainer={trainer} kicker="Your opponent" wins={wins[trainer.id]} />
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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <DifficultyPicker value={effectiveDifficulty} onChange={setDifficulty} trainer={trainer} className="min-w-64 flex-1" />
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
      <ModeHeader
        kicker="Free Battle"
        title="Choose your opponent"
        description="Any Champion, rival or boss, any time. You'll get a fresh random team for every battle."
      />
      <Steps steps={STEP_LABELS} current={STEP_INDEX.pick} />
      {saved ? <ResumeBanner saved={saved} onResume={resume} /> : null}
      {hydrated ? (
        <TrainerPicker selectedId={trainerId} onSelect={selectTrainer} wins={wins} />
      ) : (
        <EmptyState title="Loading trainers…" />
      )}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-ds border-2 border-border bg-surface/95 p-3 shadow-ds backdrop-blur">
        <p className="text-sm">
          {trainer ? (
            <>
              Selected: <span className="font-extrabold">{trainer.title} {trainer.name}</span>
            </>
          ) : (
            <span className="text-muted">Select a trainer to continue.</span>
          )}
        </p>
        <Button variant="primary" size="lg" onClick={goToPreview} disabled={!trainer}>
          Next: build your team →
        </Button>
      </div>
    </div>
  );
}
