'use client';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHydrated } from '@/lib/storage/useStorage';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  /** Called on Esc, backdrop click or the close button. */
  onClose: () => void;
  title?: ReactNode;
  /** Footer row, usually buttons. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the × button (e.g. for confirmations that need an explicit choice). */
  hideClose?: boolean;
  /** Keep the dialog open on backdrop click / Esc. */
  persistent?: boolean;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * Accessible modal dialog rendered in a portal. Esc closes, focus is trapped inside
 * while open and restored to the previously focused element on close.
 */
export function Modal({ open, onClose, title, footer, size = 'md', hideClose, persistent, children }: ModalProps) {
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const requestClose = useCallback(() => {
    if (!persistent) onClose();
  }, [onClose, persistent]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!open || !hydrated) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn('ds-panel-light w-full animate-pop-in outline-none', SIZE[size])}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b-2 border-border px-4 py-3">
            {title ? (
              <h2 id={titleId} className="font-display text-xs uppercase leading-relaxed sm:text-sm">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded border-2 border-border bg-surface text-lg leading-none hover:bg-surface-3"
              >
                ×
              </button>
            ) : null}
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t-2 border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
