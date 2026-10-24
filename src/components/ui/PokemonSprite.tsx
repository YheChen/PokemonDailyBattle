'use client';
import { useMemo, useState } from 'react';
import { assets } from '@/lib/assets/provider';
import { cn } from './cn';

export interface PokemonSpriteProps {
  /** Species name, e.g. `'Garchomp'` or `'Rotom-Wash'`. */
  species: string;
  shiny?: boolean;
  /**
   * `menu` = static gen 5 PNG; `icon` = 40×30 party icon from the sprite sheet;
   * `front` = animated gen5ani GIF (opponent-facing); `back` = animated back sprite.
   */
  variant: 'menu' | 'icon' | 'front' | 'back';
  /** Rendered pixel size (square) for `menu`/`front`/`back`. Default 96. Ignored for `icon`. */
  size?: number;
  className?: string;
  /** Override the alt text (defaults to the species name). */
  alt?: string;
}

/**
 * Pokémon sprite with a fallback chain so a missing asset never breaks the page:
 * requested sprite → static PNGs → dex sprite → Poké Ball placeholder.
 * Always rendered with `image-rendering: pixelated`.
 */
export function PokemonSprite({ species, shiny, variant, size = 96, className, alt }: PokemonSpriteProps) {
  const urls = useMemo(() => {
    if (variant === 'icon') return [];
    const side = variant === 'back' ? 'back' : 'front';
    if (variant === 'menu') {
      return dedupe([assets.pokemonMenuSprite(species, { shiny }).url, ...assets.pokemonSpriteFallbacks(species, { side, shiny })]);
    }
    return dedupe([assets.pokemonSprite(species, { side, shiny }).url, ...assets.pokemonSpriteFallbacks(species, { side, shiny })]);
  }, [species, shiny, variant]);

  // Fallback position, reset whenever the URL chain changes (derived-state pattern, no effect needed).
  const [fallback, setFallback] = useState<{ urls: string[]; index: number }>({ urls, index: 0 });
  const index = fallback.urls === urls ? fallback.index : 0;
  if (fallback.urls !== urls) setFallback({ urls, index: 0 });

  if (variant === 'icon') {
    const icon = assets.pokemonIcon(species);
    return (
      <span
        role="img"
        aria-label={alt ?? species}
        className={cn('sprite inline-block shrink-0', className)}
        style={{ width: 40, height: 30, ...icon.style }}
      />
    );
  }

  const src = urls[Math.min(index, urls.length - 1)] ?? assets.placeholder();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? species}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallback((f) => (f.index < urls.length - 1 ? { urls, index: f.index + 1 } : f))}
      className={cn('sprite object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
