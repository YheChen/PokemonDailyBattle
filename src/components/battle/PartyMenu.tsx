'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { assets } from '@/lib/assets/provider';
import type { PokemonView } from '@/lib/battle/types';
import { cn } from '@/components/ui/cn';
import { HpBar } from './HpBar';
import { StatusChip } from './StatusChip';
import { useMenuKeys } from './menuKeys';

export interface PartyMenuProps {
  /** The player's team in request order (`switch N` ⇔ `team[N-1]`). */
  team: PokemonView[];
  /** Forced replacement: no cancel button. */
  forced: boolean;
  /** The active Pokémon cannot switch out. */
  trapped: boolean;
  /**
   * Revival Blessing just resolved: the choice is which FAINTED Pokémon to revive (it stays on the bench at half
   * HP). Fainted rows are selectable, healthy ones are not. Always used with `forced`.
   */
  reviving?: boolean;
  /** Receives the 0-based party index to switch to (or to revive). */
  onChoose: (slot: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

/** The party list: icon, name, level, HP, status and item for all six, with a small switch confirmation. */
export function PartyMenu({ team, forced, trapped, reviving = false, onChoose, onCancel, disabled }: PartyMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Closes the confirmation and puts keyboard focus back on the party row it came from. */
  const dismiss = () => {
    const slot = pending;
    setPending(null);
    if (slot === null) return;
    const rows = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    rows?.[slot]?.focus({ preventScroll: true });
  };

  const menuKeys = useMenuKeys(ref, { cols: 1, onBack: forced ? undefined : onCancel });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (pending === null) return menuKeys(e);
    // While the Yes / No confirmation is open: arrows move between the two buttons, Esc closes it.
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const yes = yesRef.current;
      const no = yes?.nextElementSibling as HTMLElement | null | undefined;
      (document.activeElement === yes ? no : yes)?.focus({ preventScroll: true });
    }
  };

  // Keyboard users: Enter on a row opens the confirmation, so focus must move onto "Yes".
  useEffect(() => {
    if (pending !== null) yesRef.current?.focus({ preventScroll: true });
  }, [pending]);

  /** A row the player may currently pick: a healthy bench member, or a fainted one while reviving. */
  const selectable = (p: PokemonView) => !p.active && (reviving ? p.fainted : !p.fainted);

  const pick = (slot: number) => {
    if (disabled) return;
    const p = team[slot];
    if (!p || !selectable(p)) return;
    if (trapped && !forced) {
      setNotice("Can't escape!");
      setPending(null);
      return;
    }
    setNotice(null);
    setPending(slot);
  };

  const pendingMon = pending !== null ? team[pending] : null;

  return (
    <div ref={ref} className="space-y-2" onKeyDown={onKeyDown} role="menu" aria-label={reviving ? 'Choose a Pokémon to revive' : 'Party'}>
      {reviving ? <p className="font-pixel text-lg">Choose a Pokémon to revive.</p> : null}
      {notice ? <p className="font-pixel text-lg text-accent">{notice}</p> : null}
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((p, i) => {
          const icon = assets.pokemonIcon(p.species);
          const off = !!disabled || (reviving ? !p.fainted : p.fainted);
          return (
            <button
              key={p.ident + i}
              type="button"
              role="menuitem"
              className="party-row"
              disabled={off}
              aria-disabled={off || p.active || undefined}
              data-active={p.active ? 'true' : undefined}
              aria-label={`${p.name}, level ${p.level}, ${Math.max(0, p.hp)} of ${p.maxhp} HP${p.fainted ? ', fainted' : p.status ? `, ${p.status}` : ''}${p.active ? ', active' : ''}`}
              onClick={() => (p.active && !reviving ? setNotice(`${p.name} is already in battle!`) : pick(i))}
            >
              <span className="sprite inline-block shrink-0" style={{ width: 40, height: 30, ...icon.style }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-pixel text-lg leading-none">{p.name}</span>
                  <span className="font-pixel text-base leading-none">Lv{p.level}</span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <HpBar hp={p.hp} maxhp={p.maxhp} duration={0} variant="party" />
                  <span className="w-16 shrink-0 text-right font-pixel text-sm leading-none tabular-nums">
                    {Math.max(0, p.hp)}/{p.maxhp}
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-2 text-[0.65rem] font-bold text-[#555]">
                  {p.active ? <span className="rounded bg-[#57cc99] px-1 text-[#10301f]">ACTIVE</span> : null}
                  <StatusChip status={p.fainted ? 'fnt' : p.status} variant="menu" />
                  <span className="truncate">{p.item || 'No item'}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {pendingMon ? (
        <div className="ds-panel-flat flex flex-wrap items-center justify-between gap-2 px-3 py-2" role="group" aria-label={reviving ? 'Confirm revive' : 'Confirm switch'}>
          <span className="font-pixel text-lg">{reviving ? `Revive ${pendingMon.name}?` : `Switch in ${pendingMon.name}?`}</span>
          <span className="flex gap-2">
            <button
              ref={yesRef}
              type="button"
              className="menu-btn menu-btn-party !min-h-9 !px-3 !text-[0.6rem]"
              onClick={() => {
                const slot = pending;
                setPending(null);
                if (slot !== null) onChoose(slot);
              }}
              data-skip-nav
            >
              Yes
            </button>
            <button type="button" className="menu-btn menu-btn-back !min-h-9 !px-3 !text-[0.6rem]" onClick={dismiss} data-skip-nav>
              No
            </button>
          </span>
        </div>
      ) : null}
      {!forced ? (
        <button type="button" className={cn('menu-btn menu-btn-back w-full')} onClick={onCancel} data-skip-nav>
          Back
        </button>
      ) : null}
    </div>
  );
}
