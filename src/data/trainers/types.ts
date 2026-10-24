import type { Difficulty } from '@/lib/battle/types';

export type TrainerClass = 'Champion' | 'Elite Four' | 'Gym Leader' | 'Rival' | 'Boss' | 'Professor' | 'Trainer' | 'Legend';

export type Region =
  | 'Kanto' | 'Johto' | 'Hoenn' | 'Sinnoh' | 'Unova' | 'Kalos' | 'Alola' | 'Galar' | 'Paldea' | 'Hisui';

export type ArenaId =
  | 'indigo-plateau' | 'mt-silver' | 'sinnoh-league' | 'hoenn-league' | 'sootopolis' | 'unova-league'
  | 'kalos-league' | 'wyndon-stadium' | 'paldea-league' | 'team-rocket' | 'n-castle' | 'ghetsis-castle'
  | 'dragons-den' | 'victory-road' | 'pallet-lab' | 'alola-league' | 'hisui-ruins' | 'area-zero'
  | 'star-base' | 'kitakami' | 'mesagoza';

export interface TrainerPokemon {
  species: string;
  ability: string;
  item: string;
  nature: string;
  evs: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  ivs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  moves: [string, string, string, string];
  gender?: 'M' | 'F' | 'N';
  shiny?: boolean;
  nickname?: string;
  teraType?: string;
}

export interface TrainerDialogue {
  /** Shown before the battle, in order (each entry is one dialogue box). */
  intro: string[];
  /** Shown when the player wins. */
  playerWins: string[];
  /** Shown when the player loses. */
  playerLoses: string[];
}

export interface Trainer {
  id: string;
  name: string;
  title: TrainerClass;
  /** e.g. "Champion of the Sinnoh League" */
  subtitle: string;
  region: Region;
  /** Games the team is drawn from, e.g. "Pokémon Platinum (Champion rematch)". */
  source: string;
  /** 1 (easy) – 5 (legendary). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Default AI difficulty. */
  ai: Difficulty;
  /** Avatar id for the asset provider (see ARCHITECTURE.md for confirmed ids). */
  avatar: string;
  arena: ArenaId;
  /** The Pokémon shown on cards. */
  signature: string;
  team: [TrainerPokemon, TrainerPokemon, TrainerPokemon, TrainerPokemon, TrainerPokemon, TrainerPokemon];
  /** True when the six species match a canonical in-game team. */
  canonical: boolean;
  teamNotes?: string;
  dialogue: TrainerDialogue;
  /** Short bio shown on the trainer page. */
  bio: string;
  /** Accent color for the trainer's card / arena tint. */
  accent: string;
}
