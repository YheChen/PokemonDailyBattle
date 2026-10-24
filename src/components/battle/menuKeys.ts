'use client';
import { useEffect, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]):not([data-skip-nav]), [role="button"]:not([aria-disabled="true"])';

/**
 * DS-style keyboard navigation for a menu: arrow keys move focus through the buttons in a grid of
 * `cols` columns, Esc / Backspace trigger `onBack`. Enter / Space activate the focused button natively.
 * Returns the keydown handler to attach on the menu container.
 */
export function useMenuKeys(
  ref: RefObject<HTMLElement | null>,
  opts: { cols: number; onBack?: () => void; autoFocus?: boolean },
): (e: KeyboardEvent<HTMLElement>) => void {
  const { autoFocus = true } = opts;

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    if (el.contains(document.activeElement)) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
  }, [ref, autoFocus]);

  return (e: KeyboardEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    if (e.key === 'Escape' || e.key === 'Backspace') {
      if (opts.onBack) {
        e.preventDefault();
        e.stopPropagation();
        opts.onBack();
      }
      return;
    }
    const delta =
      e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowLeft' ? -1
      : e.key === 'ArrowDown' ? opts.cols
      : e.key === 'ArrowUp' ? -opts.cols
      : 0;
    if (!delta) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (current === -1) next = 0;
    else {
      next = current + delta;
      if (next < 0) next = Math.max(0, items.length + next);
      if (next >= items.length) next = next % items.length;
    }
    items[next]?.focus({ preventScroll: true });
  };
}
