'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PokeBall } from '@/components/ui/PokeBall';
import { useHydrated } from '@/lib/storage/useStorage';
import { cn } from '@/components/ui/cn';
import { NAV_LINKS, isActiveLink } from './navLinks';

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Current pathname (for the active state). */
  pathname: string;
}

/**
 * Slide-in navigation drawer for small screens. Closes on Esc, backdrop click
 * and whenever the route changes. Rendered in a portal on `document.body` so the
 * sticky header's backdrop filter cannot capture its fixed positioning.
 */
export function MobileDrawer({ open, onClose, pathname }: MobileDrawerProps) {
  const hydrated = useHydrated();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastPath = useRef(pathname);

  // Close when navigating.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      if (open) onClose();
    }
  }, [pathname, open, onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!hydrated) return null;

  return createPortal(
    <div
      id="mobile-drawer"
      aria-hidden={!open}
      className={cn('fixed inset-0 z-50 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <div
        className={cn('absolute inset-0 bg-black/70 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-l-2 border-border bg-surface shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b-2 border-border px-4">
          <span className="flex items-center gap-2 font-display text-[0.6rem] uppercase">
            <PokeBall size={22} /> Menu
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-ds border-2 border-border bg-surface-2 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <ul className="flex flex-col gap-1 p-3">
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-ds border-2 px-3 py-2.5 text-sm font-extrabold transition-colors',
                    active
                      ? 'border-yellow bg-surface-2 text-yellow'
                      : 'border-transparent text-muted hover:border-border hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <span aria-hidden className={cn('font-pixel text-lg leading-none', active ? 'text-yellow' : 'text-border')}>
                    ▶
                  </span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto p-4 text-xs text-muted">Not affiliated with Nintendo.</div>
      </div>
    </div>,
    document.body,
  );
}
