'use client';
import { useRef } from 'react';
import { useMenuKeys } from './menuKeys';

export interface ActionMenuProps {
  onFight: () => void;
  onParty: () => void;
  onBag: () => void;
  onForfeit: () => void;
  disabled?: boolean;
}

/** FIGHT / POKÉMON / BAG / FORFEIT in the DS 2×2 layout. Arrow keys move, Enter/Space select. */
export function ActionMenu({ onFight, onParty, onBag, onForfeit, disabled }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useMenuKeys(ref, { cols: 2 });
  return (
    <div ref={ref} className="menu-grid" role="menu" aria-label="Battle actions" onKeyDown={onKeyDown}>
      <button type="button" role="menuitem" className="menu-btn menu-btn-fight" onClick={onFight} disabled={disabled}>
        Fight
      </button>
      <button type="button" role="menuitem" className="menu-btn menu-btn-party" onClick={onParty} disabled={disabled}>
        Pokémon
      </button>
      <button type="button" role="menuitem" className="menu-btn menu-btn-bag" onClick={onBag} disabled={disabled}>
        Bag
      </button>
      <button type="button" role="menuitem" className="menu-btn menu-btn-forfeit" onClick={onForfeit} disabled={disabled}>
        Forfeit
      </button>
    </div>
  );
}
