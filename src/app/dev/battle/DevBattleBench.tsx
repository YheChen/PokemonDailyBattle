'use client';
/**
 * Dev test bench for <BattleScreen />: pick a trainer (or a random opponent), generate a random
 * player team with @pkmn/randoms, choose the speed and play. Shows the BattleResult JSON at the end.
 * Only reachable in development (page.tsx returns 404 in production builds).
 */
import { useCallback, useState } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import type { BattleResult, BattleSetup } from '@/lib/battle/types';
import { DEFAULT_FORMAT } from '@/lib/battle/types';
import { TRAINERS, type Trainer, type TrainerPokemon } from '@/data/trainers';
import { getSettings, updateSettings, type BattleSpeed } from '@/lib/storage';
import { useSettings } from '@/lib/storage/useStorage';
import { Shell } from '@/components/layout/Shell';
import { BattleScreen } from '@/components/battle/BattleScreen';
import { useSavedBattle } from '@/components/modes/ResumeBanner';

const SAVE_KEY = 'dev-battle';
const LEVEL = 100;

type Stats = Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
function fill(partial: Partial<Stats> | undefined, def: number): Stats {
  const out = { hp: def, atk: def, def: def, spa: def, spd: def, spe: def };
  for (const k of Object.keys(out) as (keyof Stats)[]) {
    const v = partial?.[k];
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}

function toSet(p: TrainerPokemon): PokemonSet {
  return {
    name: p.nickname ?? p.species,
    species: p.species,
    item: p.item ?? '',
    ability: p.ability,
    moves: [...p.moves],
    nature: p.nature,
    gender: p.gender ?? '',
    evs: fill(p.evs, 0),
    ivs: fill(p.ivs, 31),
    level: LEVEL,
    shiny: p.shiny,
    teraType: p.teraType,
  };
}

function randomSeedString(): string {
  const r = () => Math.floor(Math.random() * 0x10000);
  return `${r()},${r()},${r()},${r()}`;
}

async function randomTeam(seed: string): Promise<PokemonSet[]> {
  const [{ TeamGenerators }, { PRNG }] = await Promise.all([import('@pkmn/randoms'), import('@pkmn/sim')]);
  const generator = TeamGenerators.getTeamGenerator('gen9randombattle', new PRNG(seed as `${number},${number},${number},${number}`));
  return generator.getTeam().map((set) => ({ ...set, level: LEVEL }));
}

export function DevBattleBench() {
  const settings = useSettings();
  const [trainerId, setTrainerId] = useState<string>(TRAINERS[0]?.id ?? 'random');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = useSavedBattle(SAVE_KEY);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const battleSeed = seed.trim() || randomSeedString();
      const player = await randomTeam(`${battleSeed.split(',').map((n) => (Number(n) + 17) % 65536).join(',')}`);
      const trainer: Trainer | undefined = TRAINERS.find((t) => t.id === trainerId);
      const opponentTeam = trainer ? trainer.team.map(toSet) : await randomTeam(battleSeed);
      const next: BattleSetup = {
        mode: 'custom',
        saveKey: SAVE_KEY,
        trainerId: trainer?.id,
        config: {
          formatid: DEFAULT_FORMAT,
          seed: battleSeed,
          player: { name: getSettings().playerName || 'Player', team: player },
          opponent: {
            name: trainer?.name ?? 'Random Trainer',
            team: opponentTeam,
            difficulty: trainer?.ai ?? 'normal',
            trainerId: trainer?.id,
            avatar: trainer?.avatar,
          },
        },
      };
      setSetup(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [seed, trainerId]);

  if (setup) {
    return (
      <Shell width="wide" className="py-4 sm:py-6">
        <BattleScreen
          key={setup.config.seed}
          setup={setup}
          onFinish={(r) => {
            setResult(r);
            setSetup(null);
          }}
          onExit={() => setSetup(null)}
        />
      </Shell>
    );
  }

  return (
    <Shell className="space-y-6">
      <h1 className="font-display text-sm uppercase">Battle test bench</h1>
      <div className="ds-panel grid gap-4 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Opponent</span>
          <select className="rounded border-2 border-border bg-surface-2 px-2 py-2" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            {TRAINERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.name} ({t.ai}, {t.difficulty}★)
              </option>
            ))}
            <option value="random">Random vs random (RandomAgent)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Battle speed</span>
          <select
            className="rounded border-2 border-border bg-surface-2 px-2 py-2"
            value={settings.battleSpeed}
            onChange={(e) => updateSettings({ battleSpeed: e.target.value as BattleSpeed })}
          >
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
            <option value="instant">Instant</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Seed (optional, &ldquo;a,b,c,d&rdquo;)</span>
          <input
            className="rounded border-2 border-border bg-surface-2 px-2 py-2 font-mono"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="random"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} />
          <span className="font-bold">Reduced motion</span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
            {busy ? 'Generating…' : 'Start battle'}
          </button>
          {saved ? (
            <button type="button" className="btn btn-secondary" onClick={() => setSetup(saved.setup)}>
              Resume saved battle (vs {saved.setup.config.opponent.name})
            </button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-accent sm:col-span-2">{error}</p> : null}
      </div>
      {result ? (
        <div className="ds-panel p-4">
          <h2 className="font-display text-xs uppercase text-yellow">Last result</h2>
          <pre className="mt-2 overflow-x-auto text-xs" data-testid="result-json">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </Shell>
  );
}
