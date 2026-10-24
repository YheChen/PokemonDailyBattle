'use client';
import { useEffect, useState } from 'react';
import type { TrainerPokemon } from '@/data/trainers/types';
import { getDex } from '@/lib/data/dex';
import { typeColor, typeTextColor } from '@/lib/data/typeColors';
import { Badge } from '@/components/ui/Badge';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';

export interface TrainerTeamProps {
  team: readonly TrainerPokemon[];
  /** True when the six species match a canonical in-game team. */
  canonical: boolean;
  teamNotes?: string;
  className?: string;
}

interface MoveDetail {
  name: string;
  type: string;
  category: string;
  basePower: number;
  accuracy: number | true;
  desc: string;
}

interface SpeciesDetail {
  types: string[];
  ability: string;
  item: string;
}

interface DexDetails {
  moves: Record<string, MoveDetail>;
  species: Record<string, SpeciesDetail>;
}

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

/** "252 HP / 252 Atk / 4 Spe" */
export function formatEvs(evs: TrainerPokemon['evs']): string {
  const parts = STAT_ORDER.filter((k) => (evs[k] ?? 0) > 0).map((k) => `${evs[k]} ${STAT_LABEL[k]}`);
  return parts.length ? parts.join(' / ') : 'No EVs';
}

/** "0 Atk / 0 Spe" for non-31 IVs, or '' when all IVs are 31. */
export function formatIvs(ivs: TrainerPokemon['ivs']): string {
  if (!ivs) return '';
  return STAT_ORDER.filter((k) => ivs[k] !== undefined && ivs[k] !== 31)
    .map((k) => `${ivs[k]} ${STAT_LABEL[k]}`)
    .join(' / ');
}

async function loadDetails(team: readonly TrainerPokemon[]): Promise<DexDetails> {
  const dex = await getDex();
  const moves: Record<string, MoveDetail> = {};
  const species: Record<string, SpeciesDetail> = {};
  for (const p of team) {
    const s = dex.species.get(p.species);
    const ability = dex.abilities.get(p.ability);
    const item = dex.items.get(p.item);
    species[p.species] = {
      types: s.exists ? [...s.types] : [],
      ability: ability.exists ? ability.shortDesc || ability.desc || '' : '',
      item: item.exists ? item.shortDesc || item.desc || '' : '',
    };
    for (const m of p.moves) {
      if (moves[m]) continue;
      const mv = dex.moves.get(m);
      if (!mv.exists) continue;
      moves[m] = {
        name: mv.name,
        type: mv.type,
        category: mv.category,
        basePower: mv.basePower,
        accuracy: mv.accuracy,
        desc: mv.shortDesc || mv.desc || '',
      };
    }
  }
  return { moves, species };
}

/**
 * The six Pokémon of a trainer, one card each: sprite, species, types, item, ability, nature,
 * EV summary and the four moves as type-colored pills (details come from the gen 9 dex once loaded).
 */
export function TrainerTeam({ team, canonical, teamNotes, className }: TrainerTeamProps) {
  const [details, setDetails] = useState<DexDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDetails(team)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        /* dex failed to load — the team still renders without type/description details */
      });
    return () => {
      cancelled = true;
    };
  }, [team]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {canonical ? (
          <Badge tone="green" dot>
            Canonical team
          </Badge>
        ) : (
          <Badge tone="yellow" dot>
            Adapted team
          </Badge>
        )}
        {teamNotes ? <span className="text-muted">{teamNotes}</span> : null}
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {team.map((p, i) => (
          <li key={`${p.species}-${i}`}>
            <PokemonRow pokemon={p} slot={i + 1} species={details?.species[p.species]} moves={details?.moves} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PokemonRow({
  pokemon,
  slot,
  species,
  moves,
}: {
  pokemon: TrainerPokemon;
  slot: number;
  species?: SpeciesDetail;
  moves?: Record<string, MoveDetail>;
}) {
  const ivs = formatIvs(pokemon.ivs);
  return (
    <article className="ds-panel flex h-full flex-col gap-3 p-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded border border-border bg-bg/60 p-1">
          <PokemonSprite species={pokemon.species} shiny={pokemon.shiny} variant="menu" size={72} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">Slot {slot}</p>
          <h3 className="font-display text-xs uppercase leading-relaxed">
            {pokemon.nickname ? (
              <>
                {pokemon.nickname} <span className="text-muted">({pokemon.species})</span>
              </>
            ) : (
              pokemon.species
            )}
            {pokemon.shiny ? <span className="ml-1 text-yellow">★</span> : null}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {species?.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
            {pokemon.teraType ? (
              <span className="chip text-[0.6rem]" title="Tera type">
                Tera: {pokemon.teraType}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-extrabold uppercase tracking-wide text-muted">Item</dt>
        <dd title={species?.item || undefined}>{pokemon.item || '—'}</dd>
        <dt className="font-extrabold uppercase tracking-wide text-muted">Ability</dt>
        <dd title={species?.ability || undefined}>
          {pokemon.ability}
          {species?.ability ? <span className="block text-[0.7rem] text-muted">{species.ability}</span> : null}
        </dd>
        <dt className="font-extrabold uppercase tracking-wide text-muted">Nature</dt>
        <dd>{pokemon.nature}</dd>
        <dt className="font-extrabold uppercase tracking-wide text-muted">EVs</dt>
        <dd className="font-pixel text-base leading-none">{formatEvs(pokemon.evs)}</dd>
        {ivs ? (
          <>
            <dt className="font-extrabold uppercase tracking-wide text-muted">IVs</dt>
            <dd className="font-pixel text-base leading-none">{ivs}</dd>
          </>
        ) : null}
      </dl>

      <ul className="mt-auto grid grid-cols-2 gap-1.5">
        {pokemon.moves.map((m) => (
          <li key={m}>
            <MovePill name={m} detail={moves?.[m]} />
          </li>
        ))}
      </ul>
    </article>
  );
}

function MovePill({ name, detail }: { name: string; detail?: MoveDetail }) {
  const bg = detail ? typeColor(detail.type) : undefined;
  const fg = detail ? typeTextColor(detail.type) : undefined;
  const power = detail ? (detail.basePower > 0 ? `${detail.basePower} BP` : detail.category) : '';
  const acc = detail ? (detail.accuracy === true ? '—' : `${detail.accuracy}%`) : '';
  const title = detail ? `${detail.name} · ${detail.type} · ${detail.category} · ${power} · Acc ${acc}\n${detail.desc}` : name;
  return (
    <span
      className={cn(
        'flex flex-col rounded-ds border-2 px-2 py-1 text-left text-xs font-extrabold leading-tight shadow-ds-flat',
        !detail && 'border-border bg-surface-2 text-text',
      )}
      style={detail ? { backgroundColor: bg, color: fg, borderColor: 'rgba(0,0,0,0.25)' } : undefined}
      title={title}
    >
      <span className="truncate">{detail?.name ?? name}</span>
      {detail ? (
        <span className="text-[0.6rem] font-bold uppercase tracking-wide opacity-80">
          {detail.type} · {power}
        </span>
      ) : (
        <span className="text-[0.6rem] font-bold uppercase tracking-wide text-muted">Loading…</span>
      )}
    </span>
  );
}
