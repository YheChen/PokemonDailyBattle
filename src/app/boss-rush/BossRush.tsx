'use client';
import { useCallback, useMemo, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { bossRushOrder, getTrainer } from '@/data/trainers';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import {
  BOSS_RUSH_SAVE_KEY,
  beginRun,
  currentTrainer,
  endRun,
  isValidRun,
  persistRun,
  recordStageWin,
  stageTeamSeed,
  totalStages,
  withTeam,
} from '@/lib/game/bossRush';
import { buildBattleSetup, forfeitResultFromSave } from '@/lib/game/results';
import { reorderLead, type TeamGenSettings } from '@/lib/teams';
import { STORAGE_KEYS, clearSavedBattle, getBossRushRun, getSavedBattle, recordBattleResult, type BossRushRun, type SavedBattle } from '@/lib/storage';
import { useHydrated, useSettings, useStats, useStorageRaw } from '@/lib/storage/useStorage';
import { randomSeed } from '@/lib/util/seed';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { Stars } from '@/components/ui/Stars';
import { Toggle } from '@/components/ui/Toggle';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';
import { TeamPreview, useGeneratedTeam } from '@/components/team';
import type { BattleFinishMeta } from '@/components/battle';
import { BattleHost, ModeHeader, OpponentCard, ResultCard, ResumeBanner, useSavedBattle } from '@/components/modes';

type View = 'lobby' | 'battle' | 'stage-won' | 'run-over';

/** The active run from storage without side effects (finished / corrupt runs read as null). */
function readActiveRun(): BossRushRun | null {
  const run = getBossRushRun();
  if (!isValidRun(run) || run.status !== 'active' || !currentTrainer(run)) return null;
  return run;
}

/**
 * Boss Rush: every trainer in ascending difficulty. Optionally keep one team for the whole run
 * (HP/PP are restored between fights because every battle is a fresh simulation with the same sets).
 */
export function BossRush() {
  const hydrated = useHydrated();
  const settings = useSettings();
  const stats = useStats();

  const runRaw = useStorageRaw(STORAGE_KEYS.bossRush);
  const run = useMemo(() => {
    void runRaw;
    return hydrated ? readActiveRun() : null;
  }, [hydrated, runRaw]);
  const trainer = run ? currentTrainer(run) : null;
  const total = run ? totalStages(run) : bossRushOrder().length;

  const [view, setView] = useState<View>('lobby');
  const [keepTeam, setKeepTeam] = useState(true);
  const [teamSettings, setTeamSettings] = useState<TeamGenSettings | null>(null);
  const [rerolls, setRerolls] = useState(0);
  const [leadIndex, setLeadIndex] = useState(0);
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [lastResult, setLastResult] = useState<BattleResult | null>(null);
  const [endedRun, setEndedRun] = useState<BossRushRun | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const effectiveSettings = teamSettings ?? settings.teamSettings;
  const keptTeam = run?.keepTeam && run.team?.length ? run.team : null;
  const teamLocked = !!keptTeam;
  const genSeed = run && !keptTeam && view === 'lobby' ? `${stageTeamSeed(run)}-${rerolls}` : null;
  const generated = useGeneratedTeam(genSeed ? effectiveSettings : null, genSeed);
  const sets: PokemonSet[] = keptTeam ?? generated.sets;
  const roles = keptTeam ? undefined : generated.roles;
  const loading = !hydrated || (!keptTeam && generated.loading);

  const saved = useSavedBattle(BOSS_RUSH_SAVE_KEY);
  const resumable = saved && run && trainer && saved.setup.trainerId === trainer.id ? saved : null;

  const startRun = useCallback(() => {
    beginRun(keepTeam);
    setRerolls(0);
    setLeadIndex(0);
    setLastResult(null);
    setEndedRun(null);
    setView('lobby');
  }, [keepTeam]);

  const reroll = useCallback(() => {
    setRerolls((n) => n + 1);
    setLeadIndex(0);
  }, []);

  const changeSettings = useCallback((next: TeamGenSettings) => {
    setTeamSettings(next);
    setLeadIndex(0);
  }, []);

  const startStage = useCallback(() => {
    if (!run || !trainer || !sets.length) return;
    if (run.keepTeam && !keptTeam) persistRun(withTeam(run, sets));
    const level = sets[0]?.level === 50 ? 50 : 100;
    const next = buildBattleSetup({
      mode: 'boss-rush',
      saveKey: BOSS_RUSH_SAVE_KEY,
      trainer,
      playerName: settings.playerName,
      playerTeam: reorderLead(sets, leadIndex),
      level,
      difficulty: 'trainer',
      seed: randomSeed(),
    });
    setSetup(next);
    setLastResult(null);
    setView('battle');
  }, [run, trainer, sets, keptTeam, leadIndex, settings.playerName]);

  const resume = useCallback((s: SavedBattle) => {
    setSetup(s.setup);
    setLastResult(null);
    setView('battle');
  }, []);

  const onFinish = useCallback(
    (r: BattleResult, meta?: BattleFinishMeta) => {
      recordBattleResult(r);
      clearSavedBattle(BOSS_RUSH_SAVE_KEY);
      setLastResult(r);
      setSetup(null);
      const current = readActiveRun();
      if (!current) {
        setView('lobby');
        return;
      }
      if (r.won) {
        const next = recordStageWin(current);
        if (next.status === 'finished') {
          setEndedRun(next);
          setView('run-over');
        } else {
          setRerolls(0);
          setLeadIndex(0);
          // Exit on the overlay skips the "stage cleared" card; the win is recorded either way.
          setView(meta?.exit ? 'lobby' : 'stage-won');
        }
      } else {
        // A lost stage ends the run whether the player clicks Continue or Exit.
        setEndedRun(endRun(current));
        setView('run-over');
      }
    },
    [],
  );

  /** Leaving an unfinished stage keeps its save: the player must come back and finish (or forfeit) it. */
  const onExit = useCallback(() => {
    setSetup(null);
    setView('lobby');
  }, []);

  /** Giving up the saved stage battle: a forfeit loss that ends the run (no retries with a new seed). */
  const forfeitStage = useCallback((s: SavedBattle) => {
    const r = recordBattleResult(forfeitResultFromSave(s)).history[0] ?? null;
    clearSavedBattle(BOSS_RUSH_SAVE_KEY);
    setLastResult(r);
    setSetup(null);
    const current = readActiveRun();
    if (current) {
      setEndedRun(endRun(current));
      setView('run-over');
    } else {
      setView('lobby');
    }
  }, []);

  const abandon = useCallback(() => {
    const current = readActiveRun();
    setConfirmAbandon(false);
    const pending = getSavedBattle(BOSS_RUSH_SAVE_KEY);
    if (pending && current && pending.setup.trainerId === currentTrainer(current)?.id) {
      // The stage in progress is given up with the run.
      forfeitStage(pending);
      return;
    }
    clearSavedBattle(BOSS_RUSH_SAVE_KEY);
    if (current) setEndedRun(endRun(current));
    setSetup(null);
    setView('run-over');
  }, [forfeitStage]);

  const order = useMemo(() => bossRushOrder(), []);

  if (!hydrated) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={40} label="Loading Boss Rush…" />
      </div>
    );
  }

  if (view === 'battle' && setup) {
    return <BattleHost setup={setup} onFinish={onFinish} onExit={onExit} />;
  }

  if (view === 'run-over' && endedRun) {
    const complete = endedRun.defeated >= endedRun.order.length;
    const lastTrainer = lastResult?.trainerId ? getTrainer(lastResult.trainerId) : undefined;
    return (
      <div className="space-y-6">
        <ModeHeader
          kicker="Boss Rush"
          title={complete ? 'Run complete!' : 'Run over'}
          description={
            complete
              ? `You defeated all ${endedRun.order.length} trainers in a single run. Nothing left to prove.`
              : `Defeated ${endedRun.defeated} of ${endedRun.order.length} trainers.`
          }
        />
        <Panel title={complete ? 'Champion of Champions' : `Defeated ${endedRun.defeated} of ${endedRun.order.length}`} light scanlines>
          <div className="relative z-[2] space-y-4">
            <RunProgress order={endedRun.order} defeated={endedRun.defeated} />
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="This run" value={`${endedRun.defeated} / ${endedRun.order.length}`} />
              <Stat label="Best run" value={`${Math.max(stats.bestBossRush, endedRun.defeated)} / ${endedRun.order.length}`} />
              <Stat label="Team" value={endedRun.keepTeam ? 'Kept' : 'New each stage'} />
            </dl>
            <div className="flex flex-wrap gap-2 border-t-2 border-border/60 pt-4">
              <Button variant="primary" size="lg" onClick={() => { setEndedRun(null); setLastResult(null); setView('lobby'); }}>
                Start a new run
              </Button>
              <Button href="/stats" variant="ghost">
                Statistics
              </Button>
            </div>
          </div>
        </Panel>
        {lastResult && lastTrainer ? <ResultCard result={lastResult} trainer={lastTrainer} title="Last battle" /> : null}
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-6">
        <ModeHeader
          kicker="Boss Rush"
          title="Every trainer, back to back"
          description={`All ${order.length} trainers in ascending difficulty. One loss ends the run. Your best score is kept on the stats page.`}
          aside={stats.bestBossRush ? <Badge tone="yellow">Best: {stats.bestBossRush} / {order.length}</Badge> : null}
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <Panel title="The gauntlet" light>
            <ol className="grid gap-2 sm:grid-cols-2">
              {order.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-ds border-2 border-border bg-bg/40 px-2 py-1.5">
                  <span className="w-6 text-right font-pixel text-lg leading-none text-muted">{i + 1}</span>
                  <TrainerPortrait avatar={t.avatar} name={t.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{t.name}</span>
                    <span className="block truncate text-[0.65rem] uppercase tracking-wide text-muted">{t.title}</span>
                  </span>
                  <Stars value={t.difficulty} size={11} />
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Start a run" light className="self-start">
            <div className="space-y-4">
              <Toggle
                checked={keepTeam}
                onChange={setKeepTeam}
                label="Keep the same team for the whole run"
                description={keepTeam ? 'Your six are generated once. HP and PP are fully restored between fights.' : 'A fresh random team is generated before every stage.'}
              />
              <p className="text-xs text-muted">
                Teams use your default generation settings ({effectiveSettings.mode}, level {effectiveSettings.level}). You can tweak them before each battle.
              </p>
              <Button variant="primary" size="xl" block onClick={startRun}>
                Start Boss Rush
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const stageNo = run.index + 1;

  if (view === 'stage-won' && lastResult && trainer) {
    const beaten = lastResult.trainerId ? getTrainer(lastResult.trainerId) : undefined;
    return (
      <div className="space-y-6">
        <ModeHeader kicker="Boss Rush" title={`Stage ${run.defeated} cleared!`} description={`Next up: ${trainer.title} ${trainer.name} (stage ${stageNo} of ${total}).`} />
        <RunProgress order={run.order} defeated={run.defeated} />
        {beaten ? (
          <ResultCard
            result={lastResult}
            trainer={beaten}
            stats={[{ label: 'Run progress', value: `${run.defeated} / ${total}` }]}
            actions={
              <>
                <Button variant="primary" size="lg" onClick={() => setView('lobby')}>
                  Continue to stage {stageNo} →
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAbandon(true)}>
                  Abandon run
                </Button>
              </>
            }
          />
        ) : null}
        <AbandonModal open={confirmAbandon} onClose={() => setConfirmAbandon(false)} onConfirm={abandon} defeated={run.defeated} total={total} />
      </div>
    );
  }

  if (!trainer) return null;

  return (
    <div className="space-y-6">
      <ModeHeader
        kicker="Boss Rush"
        title={`Stage ${stageNo} of ${total}`}
        description={`${run.defeated} defeated so far. ${run.keepTeam ? 'Same team all run — HP and PP restored.' : 'Fresh team for this stage.'}`}
        aside={
          <Button variant="danger" size="sm" onClick={() => setConfirmAbandon(true)}>
            Abandon run
          </Button>
        }
      />
      <RunProgress order={run.order} defeated={run.defeated} />
      {resumable ? (
        <ResumeBanner
          saved={resumable}
          onResume={resume}
          onDiscard={forfeitStage}
          discardLabel="Forfeit stage"
          discardWarning={`Giving up this battle counts as a loss against ${trainer.title} ${trainer.name} and ends your run at ${run.defeated} of ${total} trainers defeated.`}
        />
      ) : null}
      <OpponentCard trainer={trainer} kicker={`Stage ${stageNo} of ${total}`} wins={stats.trainersDefeated[trainer.id]} />
      <TeamPreview
        title={teamLocked ? 'Your team (kept for the run)' : run.keepTeam ? 'Your team for the whole run' : `Your team for stage ${stageNo}`}
        sets={sets}
        roles={roles}
        leadIndex={leadIndex}
        onLeadChange={setLeadIndex}
        loading={loading}
        error={keptTeam ? null : generated.error}
        onRetry={keptTeam ? undefined : generated.retry}
        onReroll={teamLocked ? undefined : reroll}
        settings={teamLocked ? undefined : effectiveSettings}
        onSettingsChange={teamLocked ? undefined : changeSettings}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {teamLocked ? 'Pick your lead for this stage.' : run.keepTeam ? 'This team is locked in once the first battle starts.' : 'Reroll as much as you like before starting.'}
            </p>
            <Button variant="primary" size="xl" onClick={startStage} disabled={loading || !sets.length || (!keptTeam && !!generated.error)}>
              Start stage {stageNo}
            </Button>
          </div>
        }
      />
      <AbandonModal open={confirmAbandon} onClose={() => setConfirmAbandon(false)} onConfirm={abandon} defeated={run.defeated} total={total} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-ds border-2 border-border bg-bg/40 px-2 py-3 text-center">
      <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">{label}</dt>
      <dd className="font-display text-sm text-yellow sm:text-base">{value}</dd>
    </div>
  );
}

/** Row of trainer portraits: defeated (green), current (yellow), upcoming (dimmed). */
function RunProgress({ order, defeated }: { order: string[]; defeated: number }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={`Run progress: ${defeated} of ${order.length} defeated`}>
      {order.map((id, i) => {
        const t = getTrainer(id);
        if (!t) return null;
        const state = i < defeated ? 'done' : i === defeated ? 'current' : 'todo';
        return (
          <li
            key={id}
            title={`${i + 1}. ${t.name}${state === 'done' ? ' — defeated' : state === 'current' ? ' — now' : ''}`}
            className={cn(
              'rounded-ds border-2',
              state === 'done' && 'border-green',
              state === 'current' && 'border-yellow ring-2 ring-yellow/40',
              state === 'todo' && 'border-border opacity-40 grayscale',
            )}
          >
            <TrainerPortrait avatar={t.avatar} name={t.name} size={32} framed={false} />
          </li>
        );
      })}
    </ol>
  );
}

function AbandonModal({ open, onClose, onConfirm, defeated, total }: { open: boolean; onClose: () => void; onConfirm: () => void; defeated: number; total: number }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abandon this run?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep going
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Abandon run
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Your run ends with <span className="font-extrabold">{defeated} of {total}</span> trainers defeated. That score still counts toward your best.
      </p>
    </Modal>
  );
}
