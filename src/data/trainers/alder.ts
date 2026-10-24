import type { Trainer } from './types';

export const alder: Trainer = {
  id: 'alder',
  name: 'Alder',
  title: 'Champion',
  subtitle: 'Champion of the Unova League',
  region: 'Unova',
  source: 'Pokémon Black & White (Champion battle)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'alder',
  arena: 'unova-league',
  signature: 'Volcarona',
  accent: '#d9541e',
  bio:
    'The wandering Champion of Unova, Alder left the League to travel after losing his partner Pokémon to illness. ' +
    'He believes a Trainer\'s strength comes from the bond with their Pokémon, not from titles, and he fights with a wild, warm-hearted ferocity.',
  canonical: true,
  teamNotes: 'Alder\'s Black & White Champion team, led by his signature Volcarona.',
  dialogue: {
    intro: [
      'So you\'ve come all this way... A Trainer who treasures their Pokémon above all else.',
      'Titles mean nothing. What matters is the bond you\'ve forged on your journey!',
      'Show me the strength of that bond. Let\'s battle!',
    ],
    playerWins: [
      'Hahaha! You\'ve beaten me fair and square. What a wonderful battle!',
      'Your Pokémon fought for you with everything they had. Treasure them always.',
    ],
    playerLoses: [
      'Your Pokémon fought bravely, but the road ahead is still long.',
      'Keep walking with them, and one day you\'ll surpass me. I\'m sure of it.',
    ],
  },
  team: [
    {
      species: 'Accelgor',
      ability: 'Sticky Hold',
      item: 'Focus Sash',
      nature: 'Timid',
      evs: { spa: 252, spd: 4, spe: 252 },
      moves: ['Bug Buzz', 'Focus Blast', 'Spikes', 'Encore'],
    },
    {
      species: 'Bouffalant',
      ability: 'Sap Sipper',
      item: 'Choice Band',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Head Charge', 'Earthquake', 'Megahorn', 'Stone Edge'],
    },
    {
      species: 'Druddigon',
      ability: 'Rough Skin',
      item: 'Rocky Helmet',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, def: 4 },
      moves: ['Dragon Claw', 'Gunk Shot', 'Glare', 'Stealth Rock'],
    },
    {
      species: 'Vanilluxe',
      ability: 'Snow Warning',
      item: 'Choice Specs',
      nature: 'Modest',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Blizzard', 'Freeze-Dry', 'Flash Cannon', 'Signal Beam'],
    },
    {
      species: 'Escavalier',
      ability: 'Overcoat',
      item: 'Choice Band',
      nature: 'Adamant',
      evs: { hp: 172, atk: 252, spd: 84 },
      moves: ['Megahorn', 'Iron Head', 'Close Combat', 'Knock Off'],
    },
    {
      species: 'Volcarona',
      ability: 'Flame Body',
      item: 'Heavy-Duty Boots',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Quiver Dance', 'Fiery Dance', 'Bug Buzz', 'Giga Drain'],
    },
  ],
};
