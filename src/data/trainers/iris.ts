import type { Trainer } from './types';

export const iris: Trainer = {
  id: 'iris',
  name: 'Iris',
  title: 'Champion',
  subtitle: 'Champion of the Unova League',
  region: 'Unova',
  source: 'Pokémon Black 2 & White 2 (Champion battle)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'iris',
  arena: 'unova-league',
  signature: 'Haxorus',
  accent: '#8b3fb3',
  bio:
    'Raised among Dragon-type Pokémon in the Village of Dragons, Iris rose from Opelucid Gym Leader to become Unova\'s youngest Champion. ' +
    'Cheerful and fearless, she fights with the raw power of her dragons and her beloved partner Haxorus.',
  canonical: true,
  teamNotes: 'Iris\'s Black 2 & White 2 Champion team, led by her partner Haxorus.',
  dialogue: {
    intro: [
      'You made it all the way here! I\'ve been waiting for someone like you!',
      'My Pokémon and I are going to go all out. There\'s no holding back now!',
      'Come on, let\'s have the best battle ever!',
    ],
    playerWins: [
      'Wow... you really beat me! Your Pokémon are amazing!',
      'I\'m a little sad, but mostly I\'m happy. Thank you for such a wonderful battle!',
    ],
    playerLoses: [
      'Hee hee! My dragons and I are still the strongest!',
      'Don\'t be discouraged. Come back and challenge me again anytime!',
    ],
  },
  team: [
    {
      species: 'Hydreigon',
      ability: 'Levitate',
      item: 'Choice Specs',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Draco Meteor', 'Dark Pulse', 'Fire Blast', 'Flash Cannon'],
    },
    {
      species: 'Druddigon',
      ability: 'Rough Skin',
      item: 'Rocky Helmet',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, def: 4 },
      moves: ['Dragon Claw', 'Gunk Shot', 'Sucker Punch', 'Stealth Rock'],
    },
    {
      species: 'Aggron',
      ability: 'Rock Head',
      item: 'Choice Band',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Head Smash', 'Heavy Slam', 'Earthquake', 'Fire Punch'],
    },
    {
      species: 'Archeops',
      ability: 'Defeatist',
      item: 'Heavy-Duty Boots',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dual Wingbeat', 'Head Smash', 'Earthquake', 'U-turn'],
    },
    {
      species: 'Lapras',
      ability: 'Water Absorb',
      item: 'Leftovers',
      nature: 'Modest',
      evs: { hp: 252, def: 4, spa: 252 },
      moves: ['Freeze-Dry', 'Hydro Pump', 'Thunderbolt', 'Ice Beam'],
    },
    {
      species: 'Haxorus',
      ability: 'Mold Breaker',
      item: 'Life Orb',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Outrage', 'Earthquake', 'Poison Jab'],
    },
  ],
};
