'use client';
import type { SideID } from '@/lib/battle/types';
import { cn } from '@/components/ui/cn';
import { BOOST_IDS, boostLabel, sideConditionLabel, type DisplayPokemon, type DisplaySide } from './displayState';
import { HpBar, useAnimatedNumber } from './HpBar';
import { StatusChip } from './StatusChip';

export interface HpBoxProps {
  side: SideID;
  data: DisplaySide;
  /** HP transition duration in ms. */
  duration: number;
}

function Gender({ gender }: { gender: DisplayPokemon['gender'] }) {
  if (gender === 'M') return <span className="hpbox-gender" style={{ color: '#3b7dd8' }} aria-label="male">♂</span>;
  if (gender === 'F') return <span className="hpbox-gender" style={{ color: '#e0608a' }} aria-label="female">♀</span>;
  return null;
}

function PartyBalls({ party }: { party: DisplayPokemon[] }) {
  const slots = Array.from({ length: 6 }, (_, i) => party[i] ?? null);
  return (
    <div className="party-balls" aria-label={`${party.filter((p) => !p.fainted).length} of ${party.length} Pokémon able to battle`}>
      {slots.map((p, i) => (
        <span
          key={i}
          className={cn(
            'party-ball',
            !p && 'party-ball-empty',
            p?.fainted && 'party-ball-fainted',
            p && !p.fainted && p.status && 'party-ball-status',
          )}
          title={p ? `${p.name}${p.fainted ? ' (fainted)' : p.status ? ` (${p.status})` : ''}` : undefined}
        />
      ))}
    </div>
  );
}

function Numbers({ hp, maxhp, duration }: { hp: number; maxhp: number; duration: number }) {
  const shown = useAnimatedNumber(Math.max(0, hp), duration);
  return (
    <span className="hpbox-numbers">
      {shown}/{maxhp}
    </span>
  );
}

/**
 * DS-style HP box: name, level, gender, status chip and the HP bar. The player's box also shows the
 * exact HP numbers and a decorative EXP bar. Boost chips and side conditions sit underneath.
 */
export function HpBox({ side, data, duration }: HpBoxProps) {
  const p = data.active;
  if (!p) return null;
  const boosts = BOOST_IDS.filter((id) => p.boosts[id]);
  const conditions = Object.entries(data.sideConditions).filter(([, layers]) => layers > 0);
  const isPlayer = side === 'p1';

  return (
    <div className={cn('hpbox', `hpbox-${side}`)} aria-live="off" data-testid={`hpbox-${side}`}>
      <div className="flex items-baseline gap-[1cqw]">
        <span className="hpbox-name min-w-0 flex-1">{p.name}</span>
        <Gender gender={p.gender} />
        <span className="hpbox-level">Lv{p.level}</span>
      </div>
      <div className="mt-[0.7cqw] flex items-center gap-[0.8cqw]">
        <span className="hpbar-label">HP</span>
        <HpBar hp={p.hp} maxhp={p.maxhp} duration={duration} />
        <StatusChip status={p.fainted ? 'fnt' : p.status} />
      </div>
      {isPlayer ? (
        <div className="mt-[0.6cqw] flex items-center justify-between gap-[1cqw]">
          <Numbers hp={p.hp} maxhp={p.maxhp} duration={duration} />
          <div className="expbar w-[45%]" aria-hidden>
            <div className="expbar-fill" />
          </div>
        </div>
      ) : null}
      <PartyBalls party={data.party} />
      {boosts.length || conditions.length || p.terastallized ? (
        <div className="hpbox-chips">
          {p.terastallized ? <span className="hpbox-chip hpbox-chip-up">Tera {p.terastallized}</span> : null}
          {boosts.map((id) => (
            <span key={id} className={cn('hpbox-chip', p.boosts[id] > 0 ? 'hpbox-chip-up' : 'hpbox-chip-down')}>
              {boostLabel(id, p.boosts[id])}
            </span>
          ))}
          {conditions.map(([id, layers]) => (
            <span key={id} className="hpbox-chip hpbox-chip-side">
              {sideConditionLabel(id, layers)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
