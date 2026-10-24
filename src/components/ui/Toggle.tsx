'use client';
import { useId } from 'react';
import { cn } from './cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Accessible switch (`role="switch"`) with a label and optional description. */
export function Toggle({ checked, onChange, label, description, disabled, id, className }: ToggleProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descId = description ? `${switchId}-desc` : undefined;
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div>
        <label htmlFor={switchId} className="cursor-pointer text-sm font-extrabold">
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-xs text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors',
          checked ? 'border-[#a9ead0] bg-green' : 'border-border bg-bg',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 size-5 rounded-full border-2 border-[#1a1a1a] bg-text shadow transition-transform',
            checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
