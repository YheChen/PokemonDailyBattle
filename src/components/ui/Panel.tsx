import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

export interface PanelProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  /** Optional title rendered as a red ribbon that overlaps the panel's top edge. */
  title?: ReactNode;
  /** Extra content on the right of the ribbon row (e.g. a button). */
  actions?: ReactNode;
  /** Lighter raised look. */
  light?: boolean;
  /** Remove body padding. */
  flush?: boolean;
  /** Apply the subtle scanline overlay. */
  scanlines?: boolean;
  children?: ReactNode;
}

/**
 * DS menu panel with an optional title ribbon.
 *
 * @example <Panel title="Today's challenger">…</Panel>
 */
export function Panel({ title, actions, light, flush, scanlines, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cn(light ? 'ds-panel-light' : 'ds-panel', !!title && 'mt-3', scanlines && 'scanlines', className)}
      {...rest}
    >
      {(title || actions) && (
        <div className="relative z-[2] -mt-5 mb-1 flex items-center justify-between gap-3 px-3">
          {title ? <h2 className="ds-ribbon">{title}</h2> : <span />}
          {actions}
        </div>
      )}
      <div className={cn(!flush && 'p-4', !!title && !flush && 'pt-2')}>{children}</div>
    </section>
  );
}
