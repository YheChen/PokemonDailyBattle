import type { StatusName } from '@/lib/battle/types';
import { cn } from '@/components/ui/cn';
import { STATUS_LABELS } from './displayState';

export interface StatusChipProps {
  status: StatusName | 'fnt';
  /** `menu` = rem-sized for the party list, `box` = viewport-scaled for the HP boxes. */
  variant?: 'box' | 'menu';
  className?: string;
}

const TITLES: Record<string, string> = {
  brn: 'Burned', par: 'Paralyzed', slp: 'Asleep', frz: 'Frozen', psn: 'Poisoned', tox: 'Badly poisoned', fnt: 'Fainted',
};

/** BRN / PAR / SLP / FRZ / PSN / TOX / FNT chip. Renders nothing for an empty status. */
export function StatusChip({ status, variant = 'box', className }: StatusChipProps) {
  if (!status) return null;
  const label = status === 'fnt' ? 'FNT' : STATUS_LABELS[status];
  return (
    <span
      className={cn('status-chip', `status-${status}`, variant === 'menu' && 'status-chip-menu', className)}
      title={TITLES[status]}
      aria-label={TITLES[status]}
    >
      {label}
    </span>
  );
}
