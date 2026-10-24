import type { Trainer } from './types';

export const geeta: Trainer = {
  id: 'geeta',
  name: 'Geeta',
  title: 'Champion',
  subtitle: 'Top Champion of the Paldea League',
  region: 'Paldea',
  source: 'Pokémon Scarlet & Violet (Champion Assessment)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'geeta',
  arena: 'paldea-league',
  signature: 'Glimmora',
  accent: '#5a4fa8',
  bio:
    'The Top Champion and chairwoman of the Paldea Pokémon League, Geeta is a composed and calculating Trainer who sits at the very top of the region\'s ranks. ' +
    'She leads with Glimmora to seed the field with Toxic Spikes before her powerhouses, including the ruthless Kingambit, take over.',
  canonical: true,
  teamNotes: 'Geeta\'s Scarlet & Violet Champion Assessment team, led by Glimmora.',
  dialogue: {
    intro: [
      'So you\'ve passed every test the League could put before you. Impressive.',
      'As Top Champion, it falls to me to give the final assessment.',
      'Show me the full extent of your strength. Begin!',
    ],
    playerWins: [
      'A loss for me... Yet I find myself smiling. What a remarkable battle.',
      'You have proven yourself a Champion in every sense. Congratulations.',
    ],
    playerLoses: [
      'The gap between us is still clear. You are not yet ready for the top.',
      'Do not lose heart. Refine your strategy and return when you are prepared.',
    ],
  },
  team: [
    {
      species: 'Glimmora',
      ability: 'Toxic Debris',
      item: 'Focus Sash',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Power Gem', 'Sludge Wave', 'Earth Power', 'Stealth Rock'],
    },
    {
      species: 'Espathra',
      ability: 'Speed Boost',
      item: 'Leftovers',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Calm Mind', 'Stored Power', 'Dazzling Gleam', 'Protect'],
    },
    {
      species: 'Avalugg',
      ability: 'Sturdy',
      item: 'Heavy-Duty Boots',
      nature: 'Impish',
      evs: { hp: 252, atk: 4, def: 252 },
      moves: ['Body Press', 'Avalanche', 'Rapid Spin', 'Recover'],
    },
    {
      species: 'Veluza',
      ability: 'Sharpness',
      item: 'Choice Scarf',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Aqua Cutter', 'Psycho Cut', 'Night Slash', 'Flip Turn'],
    },
    {
      species: 'Gogoat',
      ability: 'Sap Sipper',
      item: 'Leftovers',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, spd: 4 },
      moves: ['Bulk Up', 'Horn Leech', 'Earthquake', 'Milk Drink'],
    },
    {
      species: 'Kingambit',
      ability: 'Supreme Overlord',
      item: 'Black Glasses',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, spd: 4 },
      moves: ['Swords Dance', 'Kowtow Cleave', 'Iron Head', 'Sucker Punch'],
    },
  ],
};
