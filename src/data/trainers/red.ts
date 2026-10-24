import type { Trainer } from './types';

/**
 * Red — the silent Champion waiting at the summit of Mt. Silver.
 * Team: the Gold/Silver/Crystal Mt. Silver team (Pikachu, Espeon, Snorlax, Venusaur, Charizard, Blastoise),
 * which is also the roster HeartGold/SoulSilver uses apart from Lapras in Espeon's slot.
 */
export const red: Trainer = {
  id: 'red',
  name: 'Red',
  title: 'Champion',
  subtitle: 'The silent Champion of Mt. Silver',
  region: 'Kanto',
  source: 'Pokémon Gold/Silver/Crystal & HeartGold/SoulSilver (Mt. Silver summit)',
  difficulty: 5,
  ai: 'champion',
  avatar: 'red',
  arena: 'mt-silver',
  signature: 'Pikachu',
  bio: 'The boy from Pallet Town who dismantled Team Rocket, swept the Indigo League and vanished. Trainers who climb to the frozen summit of Mt. Silver find him waiting in silence — and discover why his name is spoken like a legend.',
  accent: '#e3350d',
  canonical: true,
  teamNotes:
    'The Gold/Silver/Crystal Mt. Silver roster (HeartGold/SoulSilver swaps Espeon for Lapras). Pikachu keeps its Light Ball; Charizard carries Charizardite X.',
  dialogue: {
    intro: ['...', '... ...', '...!'],
    playerWins: ['...', '... ... ...'],
    playerLoses: ['...', '...!'],
  },
  team: [
    {
      species: 'Pikachu',
      ability: 'Static',
      item: 'Light Ball',
      nature: 'Naive',
      evs: { atk: 252, spa: 4, spe: 252 },
      moves: ['Volt Tackle', 'Surf', 'Knock Off', 'Extreme Speed'],
    },
    {
      species: 'Charizard',
      ability: 'Blaze',
      item: 'Charizardite X',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Flare Blitz', 'Dragon Claw', 'Roost'],
    },
    {
      species: 'Blastoise',
      ability: 'Torrent',
      item: 'White Herb',
      nature: 'Modest',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Shell Smash', 'Hydro Pump', 'Ice Beam', 'Dark Pulse'],
    },
    {
      species: 'Venusaur',
      ability: 'Overgrow',
      item: 'Black Sludge',
      nature: 'Bold',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Giga Drain', 'Sludge Bomb', 'Leech Seed', 'Synthesis'],
    },
    {
      species: 'Snorlax',
      ability: 'Thick Fat',
      item: 'Leftovers',
      nature: 'Careful',
      evs: { hp: 144, def: 188, spd: 176 },
      moves: ['Curse', 'Body Slam', 'Earthquake', 'Rest'],
    },
    {
      species: 'Espeon',
      ability: 'Magic Bounce',
      item: 'Leftovers',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Calm Mind', 'Psyshock', 'Dazzling Gleam', 'Morning Sun'],
    },
  ],
};
