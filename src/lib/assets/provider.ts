/**
 * Asset provider abstraction. All sprite / portrait / background URLs come from here so the
 * sources can be swapped (e.g. user-supplied assets) without touching components.
 * Default provider: Pokémon Showdown's public sprite CDN using the Gen 5 animated theme.
 */
import { Sprites, Icons } from '@pkmn/img';

export interface SpriteRef {
  url: string;
  w: number;
  h: number;
  pixelated: boolean;
}

export interface IconRef {
  /** Inline style for a 40×30 party icon (background sprite sheet). */
  style: React.CSSProperties;
}

export interface SpriteOptions {
  /** 'front' = opponent-facing sprite, 'back' = player's sprite. */
  side: 'front' | 'back';
  shiny?: boolean;
  gender?: 'M' | 'F' | 'N';
}

export interface AssetProvider {
  readonly name: string;
  /** Animated battle sprite (gen5ani). */
  pokemonSprite(species: string, opts: SpriteOptions): SpriteRef;
  /** Static fallbacks in order of preference (tried when the animated sprite 404s). */
  pokemonSpriteFallbacks(species: string, opts: SpriteOptions): string[];
  /** Static menu sprite (gen5 PNG). */
  pokemonMenuSprite(species: string, opts?: { shiny?: boolean }): SpriteRef;
  /** 40×30 party icon from the icon sheet. */
  pokemonIcon(species: string): IconRef;
  /** Trainer portrait by avatar id (e.g. 'cynthia', 'red-masters'). */
  trainerPortrait(avatar: string): string;
  /** Arena background image by Showdown background name (e.g. 'elite4drake'). */
  arenaBackground(name: string): string;
  /** Item sprite URL. */
  itemSprite(itemName: string): string;
  /** Generic placeholder used when everything else fails. */
  placeholder(): string;
  attribution: { name: string; url: string; note: string }[];
}

const CDN = 'https://play.pokemonshowdown.com';

function toId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class ShowdownAssetProvider implements AssetProvider {
  readonly name = 'Pokémon Showdown (Gen 5 theme)';

  pokemonSprite(species: string, opts: SpriteOptions): SpriteRef {
    const s = Sprites.getPokemon(species, {
      gen: 'gen5ani',
      side: opts.side === 'back' ? 'p1' : 'p2',
      shiny: opts.shiny,
      gender: opts.gender,
    });
    return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
  }

  pokemonSpriteFallbacks(species: string, opts: SpriteOptions): string[] {
    const side = opts.side === 'back' ? 'p1' : 'p2';
    const out: string[] = [];
    out.push(Sprites.getPokemon(species, { gen: 'gen5', side, shiny: opts.shiny, gender: opts.gender }).url);
    out.push(Sprites.getPokemon(species, { gen: 'gen5', side }).url);
    out.push(Sprites.getPokemon(species, { gen: 'ani', side }).url);
    out.push(`${CDN}/sprites/dex/${toId(species)}.png`);
    out.push(this.placeholder());
    return [...new Set(out)];
  }

  pokemonMenuSprite(species: string, opts: { shiny?: boolean } = {}): SpriteRef {
    const s = Sprites.getPokemon(species, { gen: 'gen5', shiny: opts.shiny });
    return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
  }

  pokemonIcon(species: string): IconRef {
    const icon = Icons.getPokemon(species);
    return { style: icon.css as React.CSSProperties };
  }

  trainerPortrait(avatar: string): string {
    return `${CDN}/sprites/trainers/${avatar.toLowerCase().replace(/[^a-z0-9-]/g, '')}.png`;
  }

  arenaBackground(name: string): string {
    return `${CDN}/sprites/gen6bgs/bg-${name}.jpg`;
  }

  itemSprite(itemName: string): string {
    return `${CDN}/sprites/itemicons/${itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  }

  placeholder(): string {
    return `${CDN}/sprites/gen5/substitute.png`;
  }

  attribution = [
    {
      name: 'Pokémon Showdown sprites',
      url: 'https://play.pokemonshowdown.com/sprites/',
      note: 'Gen 5-style animated sprites, trainer portraits, icons and backgrounds are served from Pokémon Showdown\'s public sprite repository. Pokémon and Pokémon character names are trademarks of Nintendo.',
    },
    { name: 'Pokémon Showdown battle engine (@pkmn/sim)', url: 'https://github.com/pkmn/ps', note: 'MIT licensed simulator and data.' },
    { name: 'PokéAPI', url: 'https://pokeapi.co', note: 'Species flavor text and metadata in the Pokédex.' },
  ];
}

/** The active provider. Swap at runtime (e.g. from Settings) via setAssetProvider. */
let current: AssetProvider = new ShowdownAssetProvider();

export function getAssetProvider(): AssetProvider {
  return current;
}

export function setAssetProvider(provider: AssetProvider): void {
  current = provider;
}

/** Convenience singleton accessor (components import this). */
export const assets: AssetProvider = new Proxy({} as AssetProvider, {
  get(_t, prop: keyof AssetProvider) {
    const value = current[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(current) : value;
  },
});
