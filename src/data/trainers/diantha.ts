import type { Trainer } from './types';

export const diantha: Trainer = {
  id: 'diantha',
  name: 'Diantha',
  title: 'Champion',
  subtitle: 'Champion of the Kalos League',
  region: 'Kalos',
  source: 'Pokémon X & Y (Champion battle)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'diantha',
  arena: 'kalos-league',
  signature: 'Gardevoir',
  accent: '#e07aa8',
  bio:
    'A famous movie star and the Champion of Kalos, Diantha is as graceful on the battlefield as she is on the screen. ' +
    'She believes that Trainers and Pokémon should grow and shine together, and her Mega Gardevoir is the star of her elegant team.',
  canonical: true,
  teamNotes: 'Diantha\'s X & Y Champion team. Gardevoir holds the Gardevoirite for Mega Evolution, as in the games.',
  dialogue: {
    intro: [
      'Welcome, challenger. You\'ve climbed to the very top of the Kalos League.',
      'Every battle is a chance to shine. Will you dazzle me the way the Trainers before you have?',
      'Let us make this a battle worthy of the silver screen!',
    ],
    playerWins: [
      'Marvelous! You and your Pokémon shone brighter than I could have imagined.',
      'Losing to a Trainer like you is no shame. Your journey has only just begun!',
    ],
    playerLoses: [
      'Perhaps I was too much for you this time, but what a lovely performance.',
      'Keep growing with your Pokémon, and come show me how much you\'ve changed.',
    ],
  },
  team: [
    {
      species: 'Hawlucha',
      ability: 'Unburden',
      item: 'White Herb',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Swords Dance', 'Acrobatics', 'Close Combat', 'Stone Edge'],
    },
    {
      species: 'Tyrantrum',
      ability: 'Rock Head',
      item: 'Choice Band',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Head Smash', 'Outrage', 'Earthquake', 'Close Combat'],
    },
    {
      species: 'Aurorus',
      ability: 'Snow Warning',
      item: 'Choice Specs',
      nature: 'Modest',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Blizzard', 'Freeze-Dry', 'Earth Power', 'Thunderbolt'],
    },
    {
      species: 'Gourgeist',
      ability: 'Frisk',
      item: 'Leftovers',
      nature: 'Impish',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Will-O-Wisp', 'Leech Seed', 'Shadow Sneak', 'Power Whip'],
    },
    {
      species: 'Goodra',
      ability: 'Sap Sipper',
      item: 'Assault Vest',
      nature: 'Modest',
      evs: { hp: 252, spa: 252, spd: 4 },
      moves: ['Draco Meteor', 'Fire Blast', 'Sludge Bomb', 'Thunderbolt'],
    },
    {
      species: 'Gardevoir',
      ability: 'Trace',
      item: 'Gardevoirite',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Hyper Voice', 'Psyshock', 'Focus Blast', 'Calm Mind'],
    },
  ],
};
