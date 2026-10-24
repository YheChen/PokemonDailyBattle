'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Heading } from '@/components/ui/Heading';
import { Panel } from '@/components/ui/Panel';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Spinner } from '@/components/ui/Spinner';
import { StatBar } from '@/components/ui/StatBar';
import { Tabs } from '@/components/ui/Tabs';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';
import type { MoveCategory } from '@/lib/battle/types';
import { getDex, fullLearnset, isNatDexSpecies, isSelectableSpecies, legendaryClass, type LegendaryClass } from '@/lib/data/dex';
import {
  buildPokedexIndex,
  evolutionChain,
  formatDexNumber,
  neighbours,
  toSpeciesId,
  type EvoTree,
  type PokedexBaseStats,
  type PokedexEntry,
} from '@/lib/data/pokedex';
import { fetchSpeciesMeta, formatHeight, formatWeight, type SpeciesMeta } from '@/lib/data/pokeapi';
import { typeColor } from '@/lib/data/typeColors';
import { EvolutionChain } from './EvolutionChain';
import { MovesTable, type MoveRow } from './MovesTable';

export interface PokedexDetailProps {
  /** Showdown species id (or display name) from the route. */
  id: string;
}

interface AbilityInfo {
  name: string;
  shortDesc: string;
  slot: 'Ability' | 'Hidden ability';
}
interface FormLink {
  id: string;
  name: string;
  current: boolean;
}
interface DetailData {
  id: string;
  name: string;
  num: number;
  gen: number;
  types: string[];
  baseStats: PokedexBaseStats;
  bst: number;
  forme: string;
  baseSpecies: string;
  legendary: LegendaryClass;
  weightKg: number;
  eggGroups: string[];
  abilities: AbilityInfo[];
  forms: FormLink[];
  family: EvoTree | null;
  moves: MoveRow[];
  prev?: PokedexEntry;
  next?: PokedexEntry;
}

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; data: DetailData };
type MetaState = { status: 'loading' } | { status: 'ready'; meta: SpeciesMeta | null };

const STAT_LABELS: { key: keyof PokedexBaseStats; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'Attack' },
  { key: 'def', label: 'Defense' },
  { key: 'spa', label: 'Sp. Atk' },
  { key: 'spd', label: 'Sp. Def' },
  { key: 'spe', label: 'Speed' },
];
const LEGENDARY_LABEL: Record<LegendaryClass, string | null> = {
  none: null,
  sub: 'Sub-Legendary',
  restricted: 'Restricted Legendary',
  mythical: 'Mythical',
  ultrabeast: 'Ultra Beast',
  paradox: 'Paradox',
};

function statColor(value: number): string {
  if (value >= 120) return '#57cc99';
  if (value >= 90) return '#a3d977';
  if (value >= 60) return '#f4d35e';
  if (value >= 40) return '#f5a65b';
  return '#e63946';
}

async function loadDetail(rawId: string): Promise<LoadState> {
  const dex = await getDex();
  const species = dex.species.get(toSpeciesId(rawId));
  if (!species.exists || !isNatDexSpecies(species)) return { status: 'missing' };

  const abilities: AbilityInfo[] = [];
  for (const [slot, name] of Object.entries(species.abilities)) {
    if (!name) continue;
    const a = dex.abilities.get(name);
    abilities.push({ name: a.exists ? a.name : name, shortDesc: a.exists ? a.shortDesc : '', slot: slot === 'H' ? 'Hidden ability' : 'Ability' });
  }

  const base = species.baseSpecies === species.name ? species : dex.species.get(species.baseSpecies);
  const formNames = base.exists ? [base.name, ...(base.otherFormes ?? [])] : [species.name];
  const forms: FormLink[] = [];
  for (const name of formNames) {
    const f = dex.species.get(name);
    if (!f.exists || !isNatDexSpecies(f)) continue;
    const keep = f.id === species.id || !f.forme || isSelectableSpecies(f, dex) || f.isMega || f.isPrimal || f.battleOnly;
    if (!keep) continue;
    forms.push({ id: f.id, name: f.name, current: f.id === species.id });
  }

  const learnset = await fullLearnset(dex, species.id);
  const moves: MoveRow[] = [];
  for (const id of learnset) {
    const m = dex.moves.get(id);
    if (!m.exists || m.isZ || m.isMax) continue;
    if (m.isNonstandard !== null && m.isNonstandard !== 'Past') continue;
    moves.push({
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category as MoveCategory,
      basePower: m.basePower,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      shortDesc: m.shortDesc ?? '',
    });
  }
  moves.sort((a, b) => a.name.localeCompare(b.name));

  const entries = buildPokedexIndex(dex);
  const { prev, next } = neighbours(entries, species.num);
  const chain = evolutionChain(dex, species.id);
  const b = species.baseStats;
  const data: DetailData = {
    id: species.id,
    name: species.name,
    num: species.num,
    gen: species.gen,
    types: species.types,
    baseStats: { hp: b.hp, atk: b.atk, def: b.def, spa: b.spa, spd: b.spd, spe: b.spe },
    bst: b.hp + b.atk + b.def + b.spa + b.spd + b.spe,
    forme: species.forme ?? '',
    baseSpecies: species.baseSpecies,
    legendary: legendaryClass(species),
    weightKg: species.weightkg,
    eggGroups: species.eggGroups ?? [],
    abilities,
    forms,
    family: chain?.root ?? null,
    moves,
    prev,
    next,
  };
  return { status: 'ready', data };
}

/** The whole `/pokedex/[id]` page body. */
export function PokedexDetail({ id }: PokedexDetailProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [meta, setMeta] = useState<MetaState>({ status: 'loading' });
  const [tab, setTab] = useState<'overview' | 'moves'>('overview');

  // The page remounts this component per id (`key={id}`), so no reset is needed here.
  useEffect(() => {
    let alive = true;
    loadDetail(id).then(
      (next) => {
        if (alive) setState(next);
      },
      (err: unknown) => {
        if (alive) setState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load this Pokémon.' });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const num = state.status === 'ready' ? state.data.num : null;
  useEffect(() => {
    if (num === null) return;
    let alive = true;
    const controller = new AbortController();
    fetchSpeciesMeta(num, { signal: controller.signal }).then((m) => {
      if (alive) setMeta({ status: 'ready', meta: m });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [num]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={48} label="Opening the Pokédex…" />
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <EmptyState
        title="Unknown Pokémon"
        description={
          <>
            There is no Pokédex entry for <code className="font-pixel text-lg">{id}</code>. Ids look like <code className="font-pixel text-lg">garchomp</code> or{' '}
            <code className="font-pixel text-lg">rotomwash</code>.
          </>
        }
        action={
          <Button variant="primary" href="/pokedex">
            Back to the Pokédex
          </Button>
        }
      />
    );
  }
  if (state.status === 'error') {
    return (
      <EmptyState
        title="Could not load this Pokémon"
        description={state.message}
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    );
  }

  const d = state.data;
  const tag = LEGENDARY_LABEL[d.legendary];
  const accent = typeColor(d.types[0]);
  const maxStat = 255;

  return (
    <div className="space-y-6">
      <nav className="flex items-center justify-between gap-2" aria-label="Pokédex navigation">
        <Button variant="ghost" size="sm" href="/pokedex">
          ← Pokédex
        </Button>
        <div className="flex items-center gap-2">
          {d.prev ? (
            <Button variant="ghost" size="sm" href={`/pokedex/${d.prev.id}`} title={d.prev.name}>
              ← {formatDexNumber(d.prev.num)}
            </Button>
          ) : null}
          {d.next ? (
            <Button variant="ghost" size="sm" href={`/pokedex/${d.next.id}`} title={d.next.name}>
              {formatDexNumber(d.next.num)} →
            </Button>
          ) : null}
        </div>
      </nav>

      <header className="ds-panel relative overflow-hidden p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 85% 30%, ${accent}, transparent 55%)` }} />
        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="flex size-44 shrink-0 items-center justify-center rounded-ds border-2 border-border bg-bg/60 sm:size-48">
            <PokemonSprite key={d.id} species={d.name} variant="front" size={160} />
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="font-pixel text-2xl leading-none text-muted">{formatDexNumber(d.num)}</span>
              <Badge tone="outline">Gen {d.gen}</Badge>
              {tag ? <Badge tone="yellow">{tag}</Badge> : null}
              {d.forme ? <Badge tone="blue">{d.forme} form</Badge> : null}
            </div>
            <Heading level={1} size="lg">
              {d.name}
            </Heading>
            <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-yellow">
              {meta.status === 'loading' ? <span className="text-muted">Loading species data…</span> : meta.meta?.genus || <span className="text-muted">Species data unavailable</span>}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {d.types.map((t) => (
                <TypeBadge key={t} type={t} size="lg" />
              ))}
            </div>
            <p className="font-pixel text-xl leading-snug">
              {meta.status === 'loading' ? (
                <span className="text-muted">…</span>
              ) : meta.meta?.flavorText ? (
                meta.meta.flavorText
              ) : (
                <span className="text-muted">Pokédex entry unavailable offline.</span>
              )}
            </p>
            <dl className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm sm:justify-start">
              <div>
                <dt className="inline font-extrabold text-muted">Height </dt>
                <dd className="inline font-pixel text-lg">{meta.status === 'ready' && meta.meta ? formatHeight(meta.meta.height) : '—'}</dd>
              </div>
              <div>
                <dt className="inline font-extrabold text-muted">Weight </dt>
                <dd className="inline font-pixel text-lg">{meta.status === 'ready' && meta.meta ? formatWeight(meta.meta.weight) : d.weightKg > 0 ? formatWeight(d.weightKg) : '—'}</dd>
              </div>
              {meta.status === 'ready' && meta.meta?.color ? (
                <div>
                  <dt className="inline font-extrabold text-muted">Color </dt>
                  <dd className="inline capitalize">{meta.meta.color}</dd>
                </div>
              ) : null}
              {meta.status === 'ready' && meta.meta?.habitat ? (
                <div>
                  <dt className="inline font-extrabold text-muted">Habitat </dt>
                  <dd className="inline capitalize">{meta.meta.habitat.replace(/-/g, ' ')}</dd>
                </div>
              ) : null}
              {d.eggGroups.length ? (
                <div>
                  <dt className="inline font-extrabold text-muted">Egg groups </dt>
                  <dd className="inline">{d.eggGroups.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </header>

      <Tabs<'overview' | 'moves'>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'moves', label: `Moves (${d.moves.length})` },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Base stats">
            <div className="space-y-2">
              {STAT_LABELS.map(({ key, label }) => (
                <StatBar key={key} label={label} value={d.baseStats[key]} max={maxStat} color={statColor(d.baseStats[key])} showValue={false} height={12} className="[&>span:first-child]:w-16" />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-sm sm:grid-cols-6">
              {STAT_LABELS.map(({ key, label }) => (
                <li key={key} className="flex items-baseline justify-between gap-1 sm:flex-col sm:items-center">
                  <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">{label}</span>
                  <span className="font-pixel text-xl leading-none">{d.baseStats[key]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t-2 border-border/60 pt-2 text-right text-sm font-extrabold text-muted">
              Total <span className="font-pixel text-2xl leading-none text-text">{d.bst}</span>
            </p>
          </Panel>

          <Panel title="Abilities">
            <ul className="space-y-3">
              {d.abilities.map((a) => (
                <li key={a.slot + a.name} className="rounded-ds border-2 border-border/60 bg-bg/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold">{a.name}</span>
                    <Badge tone={a.slot === 'Hidden ability' ? 'blue' : 'outline'}>{a.slot}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{a.shortDesc || 'No description available.'}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Evolution">{d.family ? <EvolutionChain root={d.family} currentId={d.id} /> : <p className="text-sm text-muted">Unknown.</p>}</Panel>

          <Panel title="Forms">
            {d.forms.length <= 1 ? (
              <p className="text-sm text-muted">{d.name} has no alternate forms.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {d.forms.map((f) => (
                  <li key={f.id}>
                    {f.current ? (
                      <span className="chip border-yellow bg-yellow text-[#1a1a1a]" aria-current="page">
                        {f.name}
                      </span>
                    ) : (
                      <Link href={`/pokedex/${f.id}`} className={cn('chip transition-[filter] hover:brightness-125 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow')}>
                        <PokemonSprite species={f.name} variant="icon" className="-my-1 scale-75" />
                        {f.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : (
        <Panel title="Learnset">
          <MovesTable moves={d.moves} />
        </Panel>
      )}
    </div>
  );
}
