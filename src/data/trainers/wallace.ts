import type { Trainer } from './types';

/**
 * Wallace — Champion of the Hoenn League in Pokémon Emerald, former Sootopolis Gym Leader.
 */
export const wallace: Trainer = {
  id: 'wallace',
  name: 'Wallace',
  title: 'Champion',
  subtitle: 'Champion of the Hoenn League',
  region: 'Hoenn',
  source: 'Pokémon Emerald (Pokémon League)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'wallace',
  arena: 'sootopolis',
  signature: 'Milotic',
  bio: 'An artist first and a Champion second, Wallace treats every battle as a performance. The former Sootopolis Gym Leader commands Water-type Pokémon with grace and flair, and his Milotic is said to be the most beautiful Pokémon in Hoenn.',
  accent: '#1fa0d8',
  canonical: true,
  teamNotes: 'His Emerald Champion team. Gyarados holds Gyaradosite.',
  dialogue: {
    intro: [
      'Welcome, challenger. I am Wallace, Champion of the Hoenn region.',
      'There is something elegant about you and your Pokémon — a grace I would love to see in battle.',
      "Let us make this a performance worthy of the stage. Please, don't hold back!",
    ],
    playerWins: [
      'Magnificent... A performance of pure beauty and strength.',
      'I concede. You are the new Champion, and I could not be prouder to pass you the title.',
    ],
    playerLoses: [
      'The grace of water carried us through. Your Pokémon fought beautifully.',
      'Refine your artistry and return. I will be waiting to see your next masterpiece.',
    ],
  },
  team: [
    {
      species: 'Wailord',
      ability: 'Water Veil',
      item: 'Choice Specs',
      nature: 'Modest',
      evs: { hp: 252, spa: 252, spd: 4 },
      moves: ['Water Spout', 'Hydro Pump', 'Ice Beam', 'Hyper Voice'],
    },
    {
      species: 'Tentacruel',
      ability: 'Clear Body',
      item: 'Black Sludge',
      nature: 'Timid',
      evs: { hp: 252, def: 4, spe: 252 },
      moves: ['Scald', 'Rapid Spin', 'Toxic Spikes', 'Knock Off'],
    },
    {
      species: 'Ludicolo',
      ability: 'Swift Swim',
      item: 'Life Orb',
      nature: 'Modest',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Rain Dance', 'Hydro Pump', 'Giga Drain', 'Ice Beam'],
    },
    {
      species: 'Whiscash',
      ability: 'Oblivious',
      item: 'Lum Berry',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Earthquake', 'Waterfall', 'Stone Edge'],
    },
    {
      species: 'Gyarados',
      ability: 'Intimidate',
      item: 'Gyaradosite',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Waterfall', 'Crunch', 'Earthquake'],
    },
    {
      species: 'Milotic',
      ability: 'Competitive',
      item: 'Leftovers',
      nature: 'Bold',
      evs: { hp: 248, def: 252, spe: 8 },
      moves: ['Scald', 'Ice Beam', 'Recover', 'Dragon Tail'],
    },
  ],
};
