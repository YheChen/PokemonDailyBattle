import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface HeadingProps extends Omit<ComponentPropsWithoutRef<'h1'>, 'children'> {
  /** Semantic level (h1–h4). Default 2. */
  level?: HeadingLevel;
  /** Visual size, independent of the level. Defaults by level. */
  size?: HeadingSize;
  /** Small muted label rendered above the heading. */
  kicker?: ReactNode;
  /** Use the UI font instead of the pixel display font. */
  plain?: boolean;
  align?: 'left' | 'center';
  children: ReactNode;
}

const SIZE: Record<HeadingSize, string> = {
  xs: 'text-[0.625rem] sm:text-xs',
  sm: 'text-xs sm:text-sm',
  md: 'text-sm sm:text-base',
  lg: 'text-base sm:text-xl',
  xl: 'text-lg sm:text-2xl md:text-3xl',
};
const DEFAULT_SIZE: Record<HeadingLevel, HeadingSize> = { 1: 'xl', 2: 'lg', 3: 'md', 4: 'sm' };

/**
 * Display-font heading (Press Start 2P) with an optional kicker label.
 */
export function Heading({ level = 2, size, kicker, plain, align = 'left', className, children, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <div className={cn(align === 'center' && 'text-center')}>
      {kicker ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-yellow">{kicker}</p>
      ) : null}
      <Tag
        className={cn(
          plain ? 'font-ui font-extrabold tracking-tight' : 'font-display uppercase',
          plain ? PLAIN_SIZE[size ?? DEFAULT_SIZE[level]] : SIZE[size ?? DEFAULT_SIZE[level]],
          'text-text',
          className,
        )}
        {...rest}
      >
        {children}
      </Tag>
    </div>
  );
}

const PLAIN_SIZE: Record<HeadingSize, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg sm:text-xl',
  lg: 'text-xl sm:text-2xl',
  xl: 'text-2xl sm:text-4xl',
};
