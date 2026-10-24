'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { assets } from '@/lib/assets/provider';
import type { GenderName, SideID } from '@/lib/battle/types';
import { cn } from '@/components/ui/cn';
import { PokeBall } from '@/components/ui/PokeBall';
import type { SpriteAnim } from './animationQueue';

export interface BattleSpriteProps {
  species: string;
  side: SideID;
  shiny?: boolean;
  gender?: GenderName;
  /** Effect to play (the class is applied on the wrapper; `animSeq` restarts it). */
  anim?: SpriteAnim;
  animSeq: number;
  /** Hide the sprite (after a faint). */
  fainted?: boolean;
  /** Scale factor applied to the GIF's natural size. */
  scale: number;
}

/**
 * Animated gen5 battle sprite with a fallback chain (animated GIF → static PNG → dex sprite →
 * Poké Ball placeholder) so a missing asset never shows a broken image.
 */
export function BattleSprite({ species, side, shiny, gender, anim, animSeq, fainted, scale }: BattleSpriteProps) {
  const facing = side === 'p1' ? 'back' : 'front';
  const urls = useMemo(() => {
    const list = [
      assets.pokemonSprite(species, { side: facing, shiny, gender }).url,
      ...assets.pokemonSpriteFallbacks(species, { side: facing, shiny, gender }),
    ];
    return [...new Set(list)];
  }, [species, facing, shiny, gender]);

  // Which URL of the chain is showing; reset when the chain changes (derived state, no effect needed).
  const [fallback, setFallback] = useState<{ urls: string[]; index: number }>({ urls, index: 0 });
  const index = fallback.urls === urls ? fallback.index : 0;
  if (fallback.urls !== urls) setFallback({ urls, index: 0 });
  const src = urls[Math.min(index, urls.length - 1)] ?? assets.placeholder();

  // Restart CSS animations when the same effect fires twice in a row.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !anim) return;
    try {
      for (const a of el.getAnimations({ subtree: true })) {
        if (a instanceof CSSAnimation && a.animationName === 'bs-bob') continue;
        a.cancel();
        a.play();
      }
    } catch {
      /* getAnimations unsupported — the class change alone restarts most effects */
    }
  }, [anim, animSeq]);

  return (
    <>
      {anim === 'switch-in' ? (
        <div className={cn('bv-ball', `bv-ball-${side}`)} key={`ball-${animSeq}`} aria-hidden>
          <PokeBall size={999} className="h-full w-full" />
        </div>
      ) : null}
      <div
        ref={ref}
        className={cn('bs', `bs-${side}`, anim && `anim-${anim}`, fainted && 'bs-fainted')}
        data-species={species}
      >
        <div className="bs-idle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={species}
            src={src}
            alt={species}
            draggable={false}
            decoding="async"
            onError={() => setFallback((f) => (f.index < urls.length - 1 ? { urls, index: f.index + 1 } : f))}
            style={{ ['--bs-scale' as string]: String(scale) }}
          />
        </div>
        {anim === 'boost-up' ? <div className="bs-sweep bs-sweep-up" aria-hidden /> : null}
        {anim === 'boost-down' ? <div className="bs-sweep bs-sweep-down" aria-hidden /> : null}
      </div>
    </>
  );
}
