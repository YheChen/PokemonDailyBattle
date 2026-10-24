import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export interface ShellProps extends ComponentPropsWithoutRef<'div'> {
  /** Content width. `default` = 72rem, `wide` = 80rem, `narrow` = 48rem. */
  width?: 'default' | 'wide' | 'narrow';
  children?: ReactNode;
}

const WIDTH = { default: 'max-w-6xl', wide: 'max-w-7xl', narrow: 'max-w-3xl' } as const;

/**
 * Page content wrapper: max width, horizontal gutters and vertical padding.
 * Every page should render its content inside a `Shell`.
 */
export function Shell({ width = 'default', className, children, ...rest }: ShellProps) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-10', WIDTH[width], className)} {...rest}>
      {children}
    </div>
  );
}
