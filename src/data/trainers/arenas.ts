import type { ArenaId } from './types';

export interface Arena {
  id: ArenaId;
  name: string;
  /** Showdown background name (sprites/gen6bgs/bg-<name>.jpg). */
  background: string;
  /** CSS gradient fallback when the image can't load. */
  fallback: string;
  /** Optional color overlay (rgba) to give each arena a distinct mood. */
  tint?: string;
}

export const ARENAS: Record<ArenaId, Arena> = {
  'indigo-plateau': { id: 'indigo-plateau', name: 'Indigo Plateau', background: 'elite4drake', fallback: 'linear-gradient(#5b3a8c, #2b1b47)', tint: 'rgba(90,60,150,0.15)' },
  'mt-silver': { id: 'mt-silver', name: 'Mt. Silver Summit', background: 'icecave', fallback: 'linear-gradient(#cfe4f7, #6f8fb0)', tint: 'rgba(200,220,255,0.15)' },
  'sinnoh-league': { id: 'sinnoh-league', name: 'Sinnoh Pokémon League', background: 'library', fallback: 'linear-gradient(#3a3f6b, #171a33)', tint: 'rgba(80,80,160,0.15)' },
  'hoenn-league': { id: 'hoenn-league', name: 'Ever Grande Pokémon League', background: 'earthycave', fallback: 'linear-gradient(#7a5a3a, #3a2a1a)' },
  'sootopolis': { id: 'sootopolis', name: 'Sootopolis Gym', background: 'leaderwallace', fallback: 'linear-gradient(#5fb8e8, #1f4f8a)', tint: 'rgba(80,160,255,0.12)' },
  'unova-league': { id: 'unova-league', name: 'Unova Pokémon League', background: 'darkcity', fallback: 'linear-gradient(#2b2b40, #0c0c16)' },
  'kalos-league': { id: 'kalos-league', name: 'Kalos Pokémon League', background: 'aquacordetown', fallback: 'linear-gradient(#f6d8e3, #8a5a7a)' },
  'wyndon-stadium': { id: 'wyndon-stadium', name: 'Wyndon Stadium', background: 'city', fallback: 'linear-gradient(#3f3f7a, #1a1a40)' },
  'paldea-league': { id: 'paldea-league', name: 'Paldea Pokémon League', background: 'meadow', fallback: 'linear-gradient(#a6d98a, #4e8a3a)' },
  'team-rocket': { id: 'team-rocket', name: 'Team Rocket Hideout', background: 'darkcity', fallback: 'linear-gradient(#333, #000)', tint: 'rgba(120,0,0,0.15)' },
  'n-castle': { id: 'n-castle', name: "N's Castle", background: 'skypillar', fallback: 'linear-gradient(#bcd, #567)' },
  'ghetsis-castle': { id: 'ghetsis-castle', name: 'Giant Chasm', background: 'darkmeadow', fallback: 'linear-gradient(#2d3a2a, #0e130d)' },
  'dragons-den': { id: 'dragons-den', name: "Dragon's Den", background: 'dampcave', fallback: 'linear-gradient(#4a3a5a, #1a1020)' },
  'victory-road': { id: 'victory-road', name: 'Victory Road', background: 'earthycave', fallback: 'linear-gradient(#8a6a4a, #3a2a1a)' },
  'pallet-lab': { id: 'pallet-lab', name: 'Pallet Town', background: 'meadow', fallback: 'linear-gradient(#b8e6a0, #5fa64a)' },
  'alola-league': { id: 'alola-league', name: 'Mount Lanakila', background: 'darkbeach', fallback: 'linear-gradient(#1a2f5a, #0a1020)' },
  'hisui-ruins': { id: 'hisui-ruins', name: 'Temple of Sinnoh', background: 'skypillar', fallback: 'linear-gradient(#d8d0c0, #6a6050)' },
  'area-zero': { id: 'area-zero', name: 'Area Zero', background: 'deepsea', fallback: 'linear-gradient(#5aa0d8, #1a3a6a)', tint: 'rgba(120,200,255,0.12)' },
  'star-base': { id: 'star-base', name: 'Team Star Base', background: 'desert', fallback: 'linear-gradient(#e8c070, #8a5a20)' },
  'kitakami': { id: 'kitakami', name: 'Kitakami', background: 'forest', fallback: 'linear-gradient(#7ab070, #2a5a30)' },
  'mesagoza': { id: 'mesagoza', name: 'Mesagoza', background: 'beach', fallback: 'linear-gradient(#f8d8a0, #c08040)' },
};

export function getArena(id: ArenaId): Arena {
  return ARENAS[id];
}
