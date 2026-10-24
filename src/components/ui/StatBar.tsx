import { cn } from './cn';

export interface StatBarProps {
  label: string;
  value: number;
  max: number;
  /**
   * CSS color for the fill. `'hp'` picks green/yellow/red from the percentage
   * (Showdown thresholds: >50 % green, >20 % yellow, else red).
   */
  color?: string | 'hp';
  /** Show "value / max" at the end. Default true. */
  showValue?: boolean;
  /** Bar height in px. Default 10. */
  height?: number;
  className?: string;
}

export function hpClass(pct: number): 'hp-green' | 'hp-yellow' | 'hp-red' {
  if (pct > 50) return 'hp-green';
  if (pct > 20) return 'hp-yellow';
  return 'hp-red';
}

/** Labeled horizontal bar (stats, HP, progress). */
export function StatBar({ label, value, max, color = 'hp', showValue = true, height = 10, className }: StatBarProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <div
        className="relative flex-1 overflow-hidden rounded-sm border border-border bg-bg"
        style={{ height }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={cn('h-full transition-[width] duration-500 ease-out', color === 'hp' && hpClass(pct))}
          style={{ width: `${pct}%`, backgroundColor: color === 'hp' ? undefined : color }}
        />
      </div>
      {showValue ? (
        <span className="w-16 shrink-0 text-right font-pixel text-base leading-none tabular-nums">
          {value}/{max}
        </span>
      ) : null}
    </div>
  );
}
