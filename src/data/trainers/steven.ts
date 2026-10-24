import type { Trainer } from './types';

/**
 * Steven Stone — Champion of the Hoenn League. Team from Pokémon Ruby/Sapphire.
 */
export const steven: Trainer = {
  id: 'steven',
  name: 'Steven',
  title: 'Champion',
  subtitle: 'Champion of the Hoenn League',
  region: 'Hoenn',
  source: 'Pokémon Ruby/Sapphire (Pokémon League)',
  difficulty: 5,
  ai: 'champion',
  avatar: 'steven',
  arena: 'hoenn-league',
  signature: 'Metagross',
  bio: 'Heir to the Devon Corporation and a collector of rare stones, Steven roams Hoenn\'s caves when he is not defending his title. His Steel-type specialists are built like fortresses, and his Metagross is the hardest wall in the league.',
  accent: '#6c7a89',
  canonical: true,
  teamNotes: 'His Ruby/Sapphire Champion team. Metagross holds Metagrossite.',
  dialogue: {
    intro: [
      "So you've made it all the way here. I've heard about your journey across Hoenn.",
      'Tell me — what do you see when you look at your Pokémon? What have you learned from them?',
      "As Champion, I'll put that bond to the test. Let's begin!",
    ],
    playerWins: [
      "Congratulations. That was a battle worthy of the Hall of Fame.",
      'You and your Pokémon have surpassed me. The title of Champion is now yours.',
    ],
    playerLoses: [
      "Your Pokémon are strong, but strength alone doesn't make a Champion.",
      'Come back when your bond has grown. I would like to face you again.',
    ],
  },
  team: [
    {
      species: 'Skarmory',
      ability: 'Sturdy',
      item: 'Rocky Helmet',
      nature: 'Impish',
      evs: { hp: 252, def: 252, spe: 4 },
      moves: ['Spikes', 'Roost', 'Brave Bird', 'Whirlwind'],
    },
    {
      species: 'Claydol',
      ability: 'Levitate',
      item: 'Leftovers',
      nature: 'Bold',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Stealth Rock', 'Earth Power', 'Rapid Spin', 'Ice Beam'],
    },
    {
      species: 'Aggron',
      ability: 'Rock Head',
      item: 'Choice Band',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, spd: 4 },
      moves: ['Head Smash', 'Heavy Slam', 'Earthquake', 'Ice Punch'],
    },
    {
      species: 'Cradily',
      ability: 'Storm Drain',
      item: 'Leftovers',
      nature: 'Careful',
      evs: { hp: 252, atk: 4, spd: 252 },
      moves: ['Curse', 'Recover', 'Seed Bomb', 'Stone Edge'],
    },
    {
      species: 'Armaldo',
      ability: 'Battle Armor',
      item: 'Life Orb',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Swords Dance', 'Stone Edge', 'X-Scissor', 'Earthquake'],
    },
    {
      species: 'Metagross',
      ability: 'Clear Body',
      item: 'Metagrossite',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Meteor Mash', 'Zen Headbutt', 'Earthquake', 'Ice Punch'],
    },
  ],
};
