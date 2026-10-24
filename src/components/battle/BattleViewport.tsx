'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { assets } from '@/lib/assets/provider';
import type { SideID } from '@/lib/battle/types';
import { cn } from '@/components/ui/cn';
import type { ActiveFx } from './animationQueue';
import { BattleSprite } from './BattleSprite';
import { weatherGroup, type DisplayState } from './displayState';
import { FieldIndicators } from './FieldIndicators';
import { HpBox } from './HpBox';

export interface ArenaLook {
  name: string;
  /** Showdown background name. */
  background: string;
  /** CSS gradient used when the image fails. */
  fallback: string;
  tint?: string;
}

export interface BattleViewportProps {
  display: DisplayState;
  fx: ActiveFx;
  arena: ArenaLook;
  /** HP transition duration (ms). */
  hpDuration: number;
  onClick?: () => void;
  /** Overlays (intro card, result panel). */
  children?: ReactNode;
  label?: string;
}

const BURST_POS: Record<SideID, { left: string; top: string }> = {
  p2: { left: '76%', top: '34%' },
  p1: { left: '27%', top: '74%' },
};

/** The DS "top screen": arena, platforms, sprites, HP boxes, field strip and effect overlays. */
export function BattleViewport({ display, fx, arena, hpDuration, onClick, children, label }: BattleViewportProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [bgFailed, setBgFailed] = useState<string | null>(null);
  const bgUrl = assets.arenaBackground(arena.background);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.5, el.clientWidth / 480));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weather = weatherGroup(display.field.weather);
  const terrain = display.field.terrain;
  const p1 = display.sides.p1.active;
  const p2 = display.sides.p2.active;

  return (
    <div
      ref={ref}
      className="bv"
      role="button"
      tabIndex={0}
      aria-label={label ?? 'Battle field. Click to continue.'}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{ ['--hp-dur' as string]: `${hpDuration}ms` }}
    >
      <div className="bv-bg" style={{ background: arena.fallback }}>
        {bgFailed !== bgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgUrl} alt="" aria-hidden draggable={false} onError={() => setBgFailed(bgUrl)} />
        ) : null}
      </div>
      {arena.tint ? <div className="bv-tint" style={{ background: arena.tint }} /> : null}

      <div className={cn('bv-terrain', terrain && `bv-terrain-${terrain}`)} data-on={terrain ? 'true' : 'false'} aria-hidden />

      <div className="bv-platform bv-platform-p2" aria-hidden />
      <div className="bv-platform bv-platform-p1" aria-hidden />

      <div className="bv-anchor bv-anchor-p2">
        {p2 ? (
          <BattleSprite
            species={p2.species}
            side="p2"
            shiny={p2.shiny}
            gender={p2.gender}
            anim={fx.sprite.p2}
            animSeq={fx.seq}
            fainted={p2.fainted && fx.sprite.p2 !== 'faint'}
            scale={scale}
          />
        ) : null}
      </div>
      <div className="bv-anchor bv-anchor-p1">
        {p1 ? (
          <BattleSprite
            species={p1.species}
            side="p1"
            shiny={p1.shiny}
            gender={p1.gender}
            anim={fx.sprite.p1}
            animSeq={fx.seq}
            fainted={p1.fainted && fx.sprite.p1 !== 'faint'}
            scale={scale * 1.2}
          />
        ) : null}
      </div>

      {fx.burst ? (
        <div
          key={`burst-${fx.seq}`}
          className="bv-burst"
          style={{ ...BURST_POS[fx.burst.side], ['--burst' as string]: fx.burst.color }}
          aria-hidden
        />
      ) : null}
      {fx.flash ? <div key={`flash-${fx.seq}`} className={cn('bv-flash', `bv-flash-${fx.flash}`)} aria-hidden /> : null}

      <div className={cn('bv-weather', weather && `bv-weather-${weather}`)} data-on={weather ? 'true' : 'false'} aria-hidden />

      {/* keyed by the Pokémon so a switch-in shows its own HP instead of animating from the previous one */}
      <HpBox key={`p2-${p2?.ident ?? ''}`} side="p2" data={display.sides.p2} duration={hpDuration} />
      <HpBox key={`p1-${p1?.ident ?? ''}`} side="p1" data={display.sides.p1} duration={hpDuration} />
      <FieldIndicators field={display.field} turn={display.turn} />

      {children}
    </div>
  );
}
