'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTrainer } from '@/data/trainers';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import { getDailyInfo, msUntilNextDaily, type DailyInfo } from '@/lib/game/daily';
import { buildBattleSetup, forfeitResult, forfeitResultFromSave } from '@/lib/game/results';
import { buildShareText } from '@/lib/game/share';
import { reorderLead } from '@/lib/teams';
import {
  STORAGE_KEYS,
  clearDailyRecord,
  clearSavedBattle,
  effectiveDailyStreak,
  getDailyRecord,
  getSavedBattle,
  listSavedBattles,
  recordBattleResult,
  saveDailyRecord,
  winRate,
  type DailyRecord,
  type SavedBattle,
} from '@/lib/storage';
import { useHydrated, useSettings, useStats, useStorageRaw } from '@/lib/storage/useStorage';
import { seedFromString } from '@/lib/util/seed';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { TeamPreview, useGeneratedTeam } from '@/components/team';
import { BattleHost, Countdown, ModeHeader, OpponentCard, ResultCard, ResumeBanner, ShareResult, useSavedBattle } from '@/components/modes';

/** Save key of the daily battle for a date (one per day so other modes never collide with it). */
function dailySaveKey(date: string): string {
  return `daily-${date}`;
}

const DAILY_SAVE_KEY_RE = /^daily-(\d{4}-\d{2}-\d{2})$/;

/** Writes the daily record and the stats for an attempt that ended in a loss (played or forfeited). */
function finalizeDailyLoss(date: string, trainerId: string, result: BattleResult): void {
  const existing = getDailyRecord(date);
  if (existing && existing.status !== 'in-progress') return;
  recordBattleResult(result, { dailyDate: date });
  saveDailyRecord({ date, trainerId, status: 'lost', result, startedAt: existing?.startedAt ?? result.finishedAt });
}

/**
 * Daily challenge: the same trainer, team and battle seed for everyone on a given UTC date.
 * One official attempt per day: once started, the battle can only be finished or forfeited.
 * Refreshing resumes the saved battle.
 */
export function DailyChallenge() {
  const hydrated = useHydrated();
  const settings = useSettings();
  const stats = useStats();

  // The UTC date is only read on the client (after hydration) so server and client never disagree;
  // `rollover` bumps when the countdown reaches zero so the page moves on to the next day.
  const [rollover, setRollover] = useState(0);
  const info = useMemo<DailyInfo | null>(() => {
    void rollover;
    return hydrated ? getDailyInfo() : null;
  }, [hydrated, rollover]);
  const trainer = info ? getTrainer(info.trainerId) ?? null : null;

  const recordRaw = useStorageRaw(info ? STORAGE_KEYS.daily(info.date) : STORAGE_KEYS.daily('none'));
  const record = useMemo<DailyRecord | null>(() => (info && recordRaw != null ? getDailyRecord(info.date) : null), [info, recordRaw]);

  const saveKey = info ? dailySaveKey(info.date) : null;
  const saved = useSavedBattle(saveKey);

  // An attempt left unfinished on an earlier date can no longer be played (its team and seed belong to
  // that day): it is finalized as a forfeit loss and its save removed.
  useEffect(() => {
    if (!info) return;
    for (const s of listSavedBattles()) {
      const m = DAILY_SAVE_KEY_RE.exec(s.setup.saveKey ?? '');
      if (!m || m[1] >= info.date) continue;
      const date = m[1];
      const rec = getDailyRecord(date);
      finalizeDailyLoss(date, s.setup.trainerId ?? rec?.trainerId ?? getDailyInfo(date).trainerId, forfeitResultFromSave(s));
      clearSavedBattle(s.setup.saveKey);
    }
  }, [info]);

  const team = useGeneratedTeam(info?.settings ?? null, info?.teamSeed ?? null);
  const [leadIndex, setLeadIndex] = useState(0);
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [active, setActive] = useState<{ date: string; trainerId: string } | null>(null);
  const [inBattle, setInBattle] = useState(false);

  const onRollover = useCallback(() => setRollover((n) => n + 1), []);
  const nextDailyMs = useCallback(() => msUntilNextDaily(), []);

  /** The in-progress attempt whose battle is gone (storage cleared elsewhere): giving it up records a loss. */
  const giveUpMissingAttempt = useCallback(() => {
    if (!info || !trainer) return;
    finalizeDailyLoss(
      info.date,
      trainer.id,
      forfeitResult({ mode: 'daily', trainerId: trainer.id, playerTeam: team.sets, opponentTeam: trainer.team, turns: 0 }),
    );
  }, [info, trainer, team.sets]);

  const start = useCallback(() => {
    if (!info || !trainer || !team.sets.length) return;
    const now = new Date().toISOString();
    const existing = getDailyRecord(info.date);
    if (existing?.status === 'in-progress' && !getSavedBattle(dailySaveKey(info.date))) {
      // One official attempt: an attempt whose battle no longer exists cannot be restarted.
      giveUpMissingAttempt();
      return;
    }
    saveDailyRecord({
      date: info.date,
      trainerId: trainer.id,
      status: 'in-progress',
      startedAt: existing?.status === 'in-progress' ? existing.startedAt : now,
    });
    const next = buildBattleSetup({
      mode: 'daily',
      saveKey: dailySaveKey(info.date),
      trainer,
      playerName: settings.playerName,
      playerTeam: reorderLead(team.sets, leadIndex),
      level: info.settings.level,
      difficulty: 'trainer',
      seed: seedFromString(info.battleSeed),
    });
    setActive({ date: info.date, trainerId: trainer.id });
    setSetup(next);
    setInBattle(true);
  }, [info, trainer, team.sets, leadIndex, settings.playerName, giveUpMissingAttempt]);

  const resume = useCallback(
    (s: SavedBattle) => {
      if (!info) return;
      setActive({ date: info.date, trainerId: s.setup.trainerId ?? info.trainerId });
      setSetup(s.setup);
      setInBattle(true);
    },
    [info],
  );

  const onFinish = useCallback(
    (r: BattleResult) => {
      const date = active?.date ?? info?.date;
      const trainerId = active?.trainerId ?? r.trainerId ?? info?.trainerId;
      if (date && trainerId) {
        recordBattleResult(r, { dailyDate: date });
        const existing = getDailyRecord(date);
        saveDailyRecord({
          date,
          trainerId,
          status: r.won ? 'won' : 'lost',
          result: r,
          startedAt: existing?.startedAt ?? r.finishedAt,
        });
        clearSavedBattle(dailySaveKey(date));
      }
      setInBattle(false);
      setSetup(null);
    },
    [active, info],
  );

  /** Leaving mid-battle keeps the save for resuming. A battle that never started (left while loading, or a failed boot) frees the attempt. */
  const onExit = useCallback(() => {
    if (active && !getSavedBattle(dailySaveKey(active.date)) && getDailyRecord(active.date)?.status === 'in-progress') {
      clearDailyRecord(active.date);
    }
    setInBattle(false);
    setSetup(null);
  }, [active]);

  /** Discarding the saved daily battle is a forfeit: the attempt is recorded as a loss. */
  const onDiscard = useCallback(
    (s: SavedBattle) => {
      const date = DAILY_SAVE_KEY_RE.exec(s.setup.saveKey ?? '')?.[1] ?? info?.date;
      const trainerId = s.setup.trainerId ?? info?.trainerId;
      if (date && trainerId) finalizeDailyLoss(date, trainerId, forfeitResultFromSave(s));
    },
    [info],
  );

  const streak = effectiveDailyStreak(stats);

  if (!info || !trainer) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={40} label="Loading today's challenge…" />
      </div>
    );
  }

  const header = (
    <ModeHeader
      kicker="Daily challenge"
      title={`${info.date} UTC`}
      description="Everyone gets the same opponent, the same six Pokémon and the same battle seed today. One official attempt — make it count."
      aside={<Countdown getMs={nextDailyMs} onElapsed={onRollover} />}
    />
  );

  if (inBattle && setup) {
    return (
      <div className="space-y-4">
        <BattleHost setup={setup} onFinish={onFinish} onExit={onExit} />
      </div>
    );
  }

  const finished = record && (record.status === 'won' || record.status === 'lost');
  if (finished) {
    const result = record.result;
    const recordTrainer = getTrainer(record.trainerId) ?? trainer;
    const trainerName = `${recordTrainer.title} ${recordTrainer.name}`;
    return (
      <div className="space-y-6">
        {header}
        {result ? (
          <ResultCard
            result={result}
            trainer={recordTrainer}
            title={result.won ? 'Daily complete — Victory!' : 'Daily complete'}
            stats={[
              { label: 'Daily streak', value: streak },
              { label: 'Total wins', value: stats.wins },
              { label: 'Win rate', value: `${winRate(stats)}%` },
            ]}
            actions={
              <>
                <Button href="/battle" variant="primary">
                  Free Battle
                </Button>
                <Button href="/boss-rush" variant="secondary">
                  Boss Rush
                </Button>
                <Button href="/stats" variant="ghost">
                  Statistics
                </Button>
              </>
            }
          >
            <ShareResult text={buildShareText({ date: record.date, trainerName, result, streak })} className="pt-2" />
          </ResultCard>
        ) : (
          <Panel title="Daily complete" light>
            <p className="font-pixel text-2xl leading-tight">
              You already played today&apos;s challenge against {trainerName}: <span className={record.status === 'won' ? 'text-green' : 'text-accent'}>{record.status === 'won' ? 'WIN' : 'LOSS'}</span>.
            </p>
            <p className="mt-2 text-sm text-muted">Come back after the countdown for a new challenger.</p>
          </Panel>
        )}
        <DailyFootnote />
      </div>
    );
  }

  const inProgress = record?.status === 'in-progress';
  const canStart = hydrated && !team.loading && !team.error && team.sets.length > 0;
  const trainerName = `${trainer.title} ${trainer.name}`;
  const discardWarning = `Giving up records today's attempt against ${trainerName} as a loss. There is only one official attempt per day.`;

  const primaryAction =
    inProgress && saved ? (
      <Button variant="primary" size="xl" block onClick={() => resume(saved)}>
        Resume Daily Battle
      </Button>
    ) : inProgress ? (
      <Button variant="danger" size="xl" block onClick={giveUpMissingAttempt} disabled={!canStart}>
        Give up today&apos;s attempt
      </Button>
    ) : (
      <Button variant="primary" size="xl" block onClick={start} disabled={!canStart}>
        Start Daily Battle
      </Button>
    );

  return (
    <div className="space-y-6">
      {header}
      {inProgress && saved ? (
        <ResumeBanner saved={saved} onResume={resume} onDiscard={onDiscard} discardLabel="Give up" discardWarning={discardWarning} />
      ) : null}
      {inProgress && !saved ? (
        <Panel title="Attempt in progress" light>
          <p className="text-sm">
            Today&apos;s attempt was started but its saved battle is no longer in this browser, so it cannot be resumed. One
            official attempt per day: giving it up records a loss against {trainerName}.
          </p>
        </Panel>
      ) : null}
      <OpponentCard
        trainer={trainer}
        kicker="Today's challenger"
        wins={stats.trainersDefeated[trainer.id]}
        aside={
          <>
            <Badge tone={inProgress ? 'yellow' : 'outline'} className="justify-center">
              {inProgress ? 'Attempt in progress' : 'Not played yet'}
            </Badge>
            {primaryAction}
            {streak > 0 ? <p className="text-center font-pixel text-lg leading-none text-muted">Streak: {streak} 🔥</p> : null}
          </>
        }
      />
      <TeamPreview
        title="Today's team"
        sets={team.sets}
        roles={team.roles}
        leadIndex={leadIndex}
        onLeadChange={setLeadIndex}
        loading={team.loading || !hydrated}
        error={team.error}
        onRetry={team.retry}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Same six for everyone today (seed <code className="font-pixel text-base">{info.teamSeed}</code>). Only your lead is up to you.
            </p>
            {inProgress && saved ? (
              <Button variant="primary" size="lg" onClick={() => resume(saved)}>
                Resume Daily Battle
              </Button>
            ) : inProgress ? null : (
              <Button variant="primary" size="lg" onClick={start} disabled={!canStart}>
                Start Daily Battle
              </Button>
            )}
          </div>
        }
      />
      <DailyFootnote />
    </div>
  );
}

function DailyFootnote() {
  return (
    <p className="text-center text-xs text-muted">
      Daily results count toward your streak and statistics. Free Battle and Boss Rush never touch the daily record.
    </p>
  );
}
