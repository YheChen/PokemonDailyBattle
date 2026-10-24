import type { ModdedDex } from '@/lib/data/dex';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';

export interface MoveRowProps {
  /** Move id or name as stored on the set. */
  move: string;
  /** Dex for details; the row degrades to the bare name when null. */
  dex: ModdedDex | null;
  className?: string;
}

const CATEGORY_ICON: Record<string, { glyph: string; label: string; className: string }> = {
  Physical: { glyph: '✊', label: 'Physical', className: 'text-[#ff9a62]' },
  Special: { glyph: '✦', label: 'Special', className: 'text-[#8fd3ff]' },
  Status: { glyph: '◎', label: 'Status', className: 'text-muted' },
};

/**
 * One move of a set: type pill, category, power, accuracy and PP from the dex.
 */
export function MoveRow({ move, dex, className }: MoveRowProps) {
  const data = dex?.moves.get(move);
  const known = !!data?.exists;
  const name = known ? data.name : move;
  const category = known ? CATEGORY_ICON[data.category] : undefined;
  const power = known ? (data.basePower > 0 ? String(data.basePower) : '—') : '';
  const accuracy = known ? (data.accuracy === true ? '—' : `${data.accuracy}%`) : '';
  const pp = known ? Math.floor((data.pp * 8) / 5) : null;

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded border border-border/60 bg-bg/40 px-2 py-1 text-xs',
        className,
      )}
      title={known ? data.shortDesc || data.desc : undefined}
    >
      {known ? <TypeBadge type={data.type} size="sm" /> : <span className="type-badge type-badge-sm bg-surface-2">???</span>}
      <span className="flex min-w-0 items-center gap-1.5">
        {category ? (
          <span className={cn('shrink-0 text-sm leading-none', category.className)} aria-label={category.label} title={category.label}>
            {category.glyph}
          </span>
        ) : null}
        <span className="truncate font-bold">{name}</span>
      </span>
      {known ? (
        <span className="flex shrink-0 items-center gap-2 font-pixel text-base leading-none text-muted">
          <span title="Base power">
            <abbr className="no-underline" title="Power">
              PWR
            </abbr>{' '}
            <span className="text-text">{power}</span>
          </span>
          <span title="Accuracy">
            ACC <span className="text-text">{accuracy}</span>
          </span>
          <span title="Power points">
            PP <span className="text-text">{pp}</span>
          </span>
        </span>
      ) : (
        <span className="font-pixel text-base leading-none text-muted">…</span>
      )}
    </li>
  );
}
