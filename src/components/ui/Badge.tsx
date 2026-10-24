import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'yellow' | 'blue' | 'green' | 'outline';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  /** Small dot before the label (e.g. for a status). */
  dot?: boolean;
  children?: ReactNode;
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'chip',
  accent: 'chip border-[#ff8a93] bg-accent text-white',
  yellow: 'chip border-[#fbe79b] bg-yellow text-[#1a1a1a]',
  blue: 'chip border-[#a6e8ff] bg-blue text-[#0b1a2a]',
  green: 'chip border-[#a9ead0] bg-green text-[#082a1c]',
  outline: 'chip bg-transparent',
};

/** Small pill label. */
export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(TONE[tone], className)} {...rest}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
