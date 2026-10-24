'use client';
import { useId, useMemo, useState } from 'react';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';
import type { MoveCategory } from '@/lib/battle/types';

export interface MoveRow {
  id: string;
  name: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  /** `true` = never misses. */
  accuracy: number | true;
  pp: number;
  priority: number;
  shortDesc: string;
}

export interface MovesTableProps {
  moves: MoveRow[];
}

type SortKey = 'name' | 'type' | 'category' | 'basePower' | 'accuracy' | 'pp';

const CATEGORY_CLASS: Record<MoveCategory, string> = {
  Physical: 'bg-[#c92112] text-white',
  Special: 'bg-[#4f5870] text-white',
  Status: 'bg-[#8c888c] text-white',
};

function accuracyValue(a: number | true): number {
  return a === true ? 101 : a;
}

const COLUMNS: { k: SortKey; label: string; className?: string }[] = [
  { k: 'name', label: 'Move' },
  { k: 'type', label: 'Type' },
  { k: 'category', label: 'Cat.' },
  { k: 'basePower', label: 'Power', className: 'text-right' },
  { k: 'accuracy', label: 'Acc.', className: 'text-right' },
  { k: 'pp', label: 'PP', className: 'text-right' },
];

interface SortHeaderProps {
  k: SortKey;
  label: string;
  className?: string;
  sortKey: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
}

function SortHeader({ k, label, className, sortKey, desc, onSort }: SortHeaderProps) {
  const active = sortKey === k;
  return (
    <th scope="col" className={cn('px-2 py-2', className)} aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 text-[0.65rem] font-extrabold uppercase tracking-wider hover:text-text', active ? 'text-yellow' : 'text-muted')}
      >
        {label}
        <span aria-hidden className={cn('text-[0.6rem]', !active && 'opacity-0')}>
          {desc ? '▼' : '▲'}
        </span>
      </button>
    </th>
  );
}

/** Searchable, sortable learnset table (name, type, category, power, accuracy, PP + description). */
export function MovesTable({ moves }: MovesTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [desc, setDesc] = useState(false);
  const searchId = useId();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? moves.filter((m) => m.name.toLowerCase().includes(q) || m.type.toLowerCase() === q || m.category.toLowerCase() === q)
      : [...moves];
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'basePower':
          cmp = a.basePower - b.basePower;
          break;
        case 'accuracy':
          cmp = accuracyValue(a.accuracy) - accuracyValue(b.accuracy);
          break;
        case 'pp':
          cmp = a.pp - b.pp;
          break;
        default:
          cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return desc ? -cmp : cmp;
    });
    return filtered;
  }, [moves, query, sortKey, desc]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(key === 'basePower' || key === 'accuracy' || key === 'pp');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Search moves
          </label>
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder="Move name, type or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md rounded-ds border-2 border-border bg-surface-2 px-3 py-2 text-sm font-bold text-text placeholder:text-muted/70 shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] hover:border-border-light"
          />
        </div>
        <p className="font-pixel text-xl text-muted" aria-live="polite">
          {rows.length} / {moves.length} moves
        </p>
      </div>

      <div className="overflow-x-auto rounded-ds border-2 border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-bg/60">
            <tr>
              {COLUMNS.map((c) => (
                <SortHeader key={c.k} k={c.k} label={c.label} className={c.className} sortKey={sortKey} desc={desc} onSort={onSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No moves match “{query}”.
                </td>
              </tr>
            ) : (
              rows.map((m, i) => (
                <tr key={m.id} className={cn('border-t border-border/50 align-top', i % 2 === 1 && 'bg-white/[0.025]')}>
                  <td className="px-2 py-2">
                    <div className="font-extrabold">
                      {m.name}
                      {m.priority !== 0 ? (
                        <span className="ml-1 text-xs font-bold text-muted" title="Priority">
                          ({m.priority > 0 ? '+' : ''}
                          {m.priority})
                        </span>
                      ) : null}
                    </div>
                    {m.shortDesc ? <div className="text-xs text-muted">{m.shortDesc}</div> : null}
                  </td>
                  <td className="px-2 py-2">
                    <TypeBadge type={m.type} size="sm" />
                  </td>
                  <td className="px-2 py-2">
                    <span className={cn('inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider', CATEGORY_CLASS[m.category])}>
                      {m.category}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-pixel text-lg leading-none tabular-nums">{m.basePower > 0 ? m.basePower : '—'}</td>
                  <td className="px-2 py-2 text-right font-pixel text-lg leading-none tabular-nums">{m.accuracy === true ? '—' : `${m.accuracy}%`}</td>
                  <td className="px-2 py-2 text-right font-pixel text-lg leading-none tabular-nums">{m.pp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
