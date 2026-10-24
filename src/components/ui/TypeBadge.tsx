import { typeColor, typeTextColor } from '@/lib/data/typeColors';
import { cn } from './cn';

export interface TypeBadgeProps {
  /** Type name such as `'Fire'` (case-sensitive as in the dex). */
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Colored Pokémon type label using the shared type palette. */
export function TypeBadge({ type, size = 'md', className }: TypeBadgeProps) {
  return (
    <span
      className={cn('type-badge', size === 'sm' && 'type-badge-sm', size === 'lg' && 'type-badge-lg', className)}
      style={{ backgroundColor: typeColor(type), color: typeTextColor(type) }}
    >
      {type}
    </span>
  );
}
