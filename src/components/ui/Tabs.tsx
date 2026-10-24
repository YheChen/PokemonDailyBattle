'use client';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Panel content. Omit to render only the tab list and handle content yourself. */
  content?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  /** Selected tab id (controlled). */
  value: T;
  onChange: (id: T) => void;
  /** Stretch tabs across the full width. */
  fill?: boolean;
  className?: string;
}

/**
 * Accessible, controlled tab list (roving tabindex, arrow keys, Home/End).
 * Renders the active item's `content` under the list when provided.
 */
export function Tabs<T extends string>({ items, value, onChange, fill, className }: TabsProps<T>) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.id === value);
    if (idx < 0 || enabled.length === 0) return;
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else return;
    e.preventDefault();
    const target = enabled[next];
    onChange(target.id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${target.id}"]`)?.focus();
  };

  const active = items.find((i) => i.id === value);

  return (
    <div className={className}>
      <div ref={listRef} role="tablist" onKeyDown={onKeyDown} className="flex flex-wrap gap-1 border-b-2 border-border">
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={item.content !== undefined ? `${baseId}-panel-${item.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              data-tab-id={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                '-mb-0.5 rounded-t border-2 border-b-0 px-3 py-2 text-sm font-extrabold transition-colors',
                fill && 'flex-1',
                selected
                  ? 'border-border bg-surface-2 text-text'
                  : 'border-transparent text-muted hover:bg-white/5 hover:text-text',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active?.content !== undefined ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className="pt-4"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
