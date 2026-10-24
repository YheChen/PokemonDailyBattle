import type { Trainer } from './types';

export const leon: Trainer = {
  id: 'leon',
  name: 'Leon',
  title: 'Champion',
  subtitle: 'Undefeated Champion of Galar',
  region: 'Galar',
  source: 'Pokémon Sword & Shield (Champion Cup final)',
  difficulty: 5,
  ai: 'champion',
  avatar: 'leon',
  arena: 'wyndon-stadium',
  signature: 'Charizard',
  accent: '#d4342a',
  bio:
    'Galar\'s unbeatable Champion, Leon has never lost an official match since winning the title as a child. ' +
    'Beloved across the region for his showmanship and his terrible sense of direction, he and his partner Charizard put on a champion time in every battle.',
  canonical: false,
  teamNotes: 'Adapted from Leon\'s Sword & Shield Champion Cup team: in the games his sixth Pokémon depends on your starter (Rillaboom, Cinderace or Inteleon), so this roster combines Rillaboom and Cinderace as the spec requests, led by his partner Charizard.',
  dialogue: {
    intro: [
      'You made it all the way to me! The whole of Galar is watching this one.',
      'I\'m the unbeatable Champion, and Charizard and I don\'t plan on losing today.',
      'Let\'s give everyone a battle they\'ll never forget. Time for a champion time!',
    ],
    playerWins: [
      'My time as Champion... is over? What a battle! The crowd is going wild!',
      'You\'ve got the strength of a true Champion. Galar is in great hands.',
    ],
    playerLoses: [
      'Ha! Still undefeated! Charizard and I had a champion time!',
      'Don\'t look so down. Train hard and come challenge me again. I\'ll be waiting!',
    ],
  },
  team: [
    {
      species: 'Aegislash',
      ability: 'Stance Change',
      item: 'Leftovers',
      nature: 'Quiet',
      evs: { hp: 252, atk: 4, spa: 252 },
      moves: ['King\'s Shield', 'Shadow Ball', 'Flash Cannon', 'Shadow Sneak'],
    },
    {
      species: 'Dragapult',
      ability: 'Infiltrator',
      item: 'Choice Specs',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'],
    },
    {
      species: 'Haxorus',
      ability: 'Mold Breaker',
      item: 'Life Orb',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Outrage', 'Earthquake', 'Poison Jab'],
    },
    {
      species: 'Rillaboom',
      ability: 'Grassy Surge',
      item: 'Choice Band',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Grassy Glide', 'Wood Hammer', 'Knock Off', 'U-turn'],
    },
    {
      species: 'Cinderace',
      ability: 'Libero',
      item: 'Heavy-Duty Boots',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Pyro Ball', 'High Jump Kick', 'U-turn', 'Sucker Punch'],
    },
    {
      species: 'Charizard',
      ability: 'Blaze',
      item: 'Heavy-Duty Boots',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Fire Blast', 'Air Slash', 'Solar Beam', 'Sunny Day'],
    },
  ],
};
