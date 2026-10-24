'use client';
import { useId, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string>
  extends Omit<ComponentPropsWithoutRef<'select'>, 'value' | 'onChange' | 'children'> {
  label?: string;
  /** Helper text under the field. */
  hint?: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Lay the label and field out on one row. */
  inline?: boolean;
}

/** Styled native `<select>` with an attached label. */
export function Select<T extends string>({ label, hint, options, value, onChange, inline, className, id, ...rest }: SelectProps<T>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn('flex gap-1.5', inline ? 'flex-row items-center gap-3' : 'flex-col', className)}>
      {label ? (
        <label htmlFor={selectId} className="text-xs font-extrabold uppercase tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none rounded-ds border-2 border-border bg-surface-2 py-2 pl-3 pr-9 text-sm font-bold text-text shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] hover:border-border-light disabled:opacity-50"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-muted">
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
