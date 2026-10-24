'use client';
import { useMemo, useRef, useState } from 'react';
import type { MoveRequestView, MoveView } from '@/lib/battle/types';
import { typeColor, typeTextColor } from '@/lib/data/typeColors';
import { useMenuKeys } from './menuKeys';

export interface MoveMenuProps {
  active: MoveRequestView;
  /** Receives the Showdown choice string ("move 2", "move 1 mega", …). */
  onChoose: (choice: string) => void;
  onBack: () => void;
  disabled?: boolean;
}

type Gimmick = 'none' | 'mega' | 'ultra' | 'zmove' | 'tera';

const CATEGORY_ICON: Record<MoveView['category'], { glyph: string; label: string; color: string }> = {
  Physical: { glyph: '✊', label: 'Physical', color: '#e8743b' },
  Special: { glyph: '✦', label: 'Special', color: '#6b8ae8' },
  Status: { glyph: '◎', label: 'Status', color: '#9a9ab0' },
};

function MoveDetails({ move, zName }: { move: MoveView; zName: string | null }) {
  const cat = CATEGORY_ICON[move.category] ?? CATEGORY_ICON.Status;
  return (
    <div className="ds-panel-flat px-3 py-2 text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-extrabold">{zName ?? move.name}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: cat.color }} title={cat.label}>
          <span aria-hidden>{cat.glyph}</span> {cat.label}
        </span>
        <span className="text-xs text-muted">
          Power <b className="text-text">{move.basePower || '—'}</b>
        </span>
        <span className="text-xs text-muted">
          Acc <b className="text-text">{move.accuracy === true ? '—' : `${move.accuracy}%`}</b>
        </span>
        {move.priority ? (
          <span className="text-xs text-muted">
            Priority <b className="text-text">{move.priority > 0 ? `+${move.priority}` : move.priority}</b>
          </span>
        ) : null}
      </div>
      {move.desc ? <p className="mt-1 text-xs leading-snug text-muted">{move.desc}</p> : null}
    </div>
  );
}

/**
 * 2×2 move grid colored by type with PP, a details panel on hover/focus/long-press, the
 * MEGA EVOLVE / ULTRA BURST / Z-MOVE / TERASTALLIZE toggles and a BACK button. Struggle when nothing is usable.
 */
export function MoveMenu({ active, onChoose, onBack, disabled }: MoveMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useMenuKeys(ref, { cols: 2, onBack });
  const [gimmick, setGimmick] = useState<Gimmick>('none');
  const [detail, setDetail] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const moves = active.moves;
  const usable = useMemo(() => moves.filter((m) => !m.disabled), [moves]);
  const zMoves = active.canZMove;

  const choose = (index: number) => {
    if (disabled) return;
    const suffix =
      gimmick === 'mega' ? ' mega'
      : gimmick === 'ultra' ? ' ultra'
      : gimmick === 'zmove' ? ' zmove'
      : gimmick === 'tera' ? ' terastallize'
      : '';
    onChoose(`move ${index + 1}${suffix}`);
  };

  const startPress = (i: number) => {
    longPressed.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setDetail(i);
    }, 420);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  if (!usable.length) {
    return (
      <div ref={ref} className="space-y-2" onKeyDown={onKeyDown}>
        <p className="font-pixel text-lg text-muted">No moves left… it can only Struggle!</p>
        <div className="menu-grid">
          <button
            type="button"
            className="move-btn"
            style={{ backgroundColor: typeColor('Normal'), color: typeTextColor('Normal') }}
            onClick={() => !disabled && onChoose('move 1')}
            disabled={disabled}
          >
            <span className="move-name">Struggle</span>
            <span className="move-meta">
              <span className="move-type">Normal</span>
            </span>
          </button>
          <button type="button" className="menu-btn menu-btn-back" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const detailMove = detail !== null ? moves[detail] : null;

  return (
    <div ref={ref} className="space-y-2" onKeyDown={onKeyDown} onMouseLeave={() => setDetail(null)}>
      {(active.canMegaEvo || active.canUltraBurst || zMoves || active.canTerastallize) && (
        <div className="flex flex-wrap gap-2">
          {active.canMegaEvo ? (
            <button
              type="button"
              className="gimmick-toggle"
              aria-pressed={gimmick === 'mega'}
              onClick={() => setGimmick((g) => (g === 'mega' ? 'none' : 'mega'))}
            >
              Mega Evolve
            </button>
          ) : null}
          {active.canUltraBurst ? (
            <button
              type="button"
              className="gimmick-toggle"
              aria-pressed={gimmick === 'ultra'}
              onClick={() => setGimmick((g) => (g === 'ultra' ? 'none' : 'ultra'))}
            >
              Ultra Burst
            </button>
          ) : null}
          {zMoves ? (
            <button
              type="button"
              className="gimmick-toggle"
              aria-pressed={gimmick === 'zmove'}
              onClick={() => setGimmick((g) => (g === 'zmove' ? 'none' : 'zmove'))}
            >
              Z-Move
            </button>
          ) : null}
          {active.canTerastallize ? (
            <button
              type="button"
              className="gimmick-toggle"
              aria-pressed={gimmick === 'tera'}
              onClick={() => setGimmick((g) => (g === 'tera' ? 'none' : 'tera'))}
            >
              Terastallize ({active.canTerastallize})
            </button>
          ) : null}
        </div>
      )}
      <div className="menu-grid" role="menu" aria-label="Moves">
        {moves.map((m, i) => {
          const z = zMoves?.[i] ?? null;
          const zBlocked = gimmick === 'zmove' && !z;
          const off = m.disabled || zBlocked || !!disabled;
          const type = m.type;
          return (
            <button
              key={m.id + i}
              type="button"
              role="menuitem"
              className="move-btn"
              aria-disabled={off || undefined}
              disabled={off}
              data-selected={detail === i ? 'true' : undefined}
              aria-label={`${gimmick === 'zmove' && z ? z : m.name}, ${type}, ${m.pp} of ${m.maxpp} PP${m.disabled ? ', disabled' : ''}`}
              style={{ backgroundColor: typeColor(type), color: typeTextColor(type) }}
              onClick={() => {
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                if (!off) choose(i);
              }}
              onMouseEnter={() => setDetail(i)}
              onFocus={() => setDetail(i)}
              onTouchStart={() => startPress(i)}
              onTouchEnd={endPress}
              onTouchCancel={endPress}
              onContextMenu={(e) => e.preventDefault()}
              title={m.disabled ? `${m.name} cannot be used right now` : undefined}
            >
              <span className="move-name">{gimmick === 'zmove' && z ? z : m.name}</span>
              <span className="move-meta">
                <span className="move-type" style={{ color: typeTextColor(type) }}>
                  {type}
                </span>
                <span>
                  PP {m.pp}/{m.maxpp}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-start gap-2">
        <button type="button" className="menu-btn menu-btn-back shrink-0" onClick={onBack} data-skip-nav>
          Back
        </button>
        <div className="min-w-0 flex-1">
          {detailMove ? <MoveDetails move={detailMove} zName={gimmick === 'zmove' ? zMoves?.[detail ?? 0] ?? null : null} /> : (
            <p className="px-1 py-2 text-xs text-muted">Hover, focus or hold a move for details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
