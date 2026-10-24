'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export interface FilterChipProps {
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Colors applied when active (e.g. a type color). */
  activeStyle?: CSSProperties;
  className?: string;
  title?: string;
}

/** Toggleable pill button (`aria-pressed`) used for generation and type filters. */
export function FilterChip({ active, onToggle, children, activeStyle, className, title }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onToggle}
      style={active ? activeStyle : undefined}
      className={cn(
        'chip cursor-pointer select-none transition-[filter,transform] hover:brightness-110 active:translate-y-px',
        active ? 'border-yellow bg-yellow text-[#1a1a1a]' : 'text-muted hover:text-text',
        className,
      )}
    >
      {children}
    </button>
  );
}
