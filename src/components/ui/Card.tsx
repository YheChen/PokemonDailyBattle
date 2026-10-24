import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** Render as another element (e.g. `'article'`, `'li'`). */
  as?: ElementType;
  /** Lift on hover and show a pointer (for clickable cards). */
  interactive?: boolean;
  /** Use the lighter raised panel style. */
  light?: boolean;
  /** Remove the default padding. */
  flush?: boolean;
  children?: ReactNode;
}

/**
 * Generic DS-panel surface with padding. Use `interactive` for cards that link somewhere.
 */
export function Card({ as, interactive, light, flush, className, children, ...rest }: CardProps) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      className={cn(
        light ? 'ds-panel-light' : 'ds-panel',
        !flush && 'p-4',
        interactive &&
          'transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-110 focus-within:-translate-y-0.5',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
