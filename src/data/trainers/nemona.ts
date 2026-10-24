import type { Trainer } from './types';

export const nemona: Trainer = {
  id: 'nemona',
  name: 'Nemona',
  title: 'Rival',
  subtitle: 'Champion-Rank Rival of Paldea',
  region: 'Paldea',
  source: 'Pokémon Scarlet & Violet (final rival battle at Mesagoza)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'nemona-masters',
  arena: 'mesagoza',
  signature: 'Meowscarada',
  accent: '#f2a51c',
  bio:
    'A battle-obsessed Champion-ranked student at Naranja/Uva Academy, Nemona held back her full strength for an entire journey just so she could face a rival who could keep up. ' +
    'Her Meowscarada has grown alongside the player\'s starter, and she is at her happiest with a Poké Ball in hand.',
  canonical: true,
  teamNotes:
    'Nemona\'s final rival team from Scarlet & Violet (the Mesagoza battle after the Champion Assessment). ' +
    'Her starter depends on the player\'s choice; Meowscarada is used here. Items and EVs are competitive upgrades over the in-game sets.',
  dialogue: {
    intro: [
      'There you are! I\'ve been waiting for this moment the whole journey!',
      'No more holding back. This is my real team, my real strength!',
      'Let\'s go! This is the battle I\'ve always wanted!',
    ],
    playerWins: [
      'Ahh... I lost! But that was the BEST battle ever!',
      'You\'re my rival for life now, got it? We\'re doing this again, and again, and again!',
    ],
    playerLoses: [
      'Yes! We did it! That felt amazing!',
      'Don\'t worry, you\'ll get me next time. Now hurry up and get stronger so we can battle again!',
    ],
  },
  team: [
    {
      species: 'Lycanroc',
      ability: 'Sand Rush',
      item: 'Choice Band',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Accelerock', 'Stone Edge', 'Close Combat', 'Crunch'],
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
      species: 'Dudunsparce',
      ability: 'Serene Grace',
      item: 'Leftovers',
      nature: 'Careful',
      evs: { hp: 252, def: 4, spd: 252 },
      moves: ['Coil', 'Body Slam', 'Roost', 'Glare'],
    },
    {
      species: 'Orthworm',
      ability: 'Earth Eater',
      item: 'Leftovers',
      nature: 'Impish',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Iron Head', 'Body Press', 'Stealth Rock', 'Shed Tail'],
    },
    {
      species: 'Pawmot',
      ability: 'Iron Fist',
      item: 'Focus Sash',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Thunder Punch', 'Close Combat', 'Ice Punch', 'Revival Blessing'],
    },
    {
      species: 'Meowscarada',
      ability: 'Protean',
      item: 'Choice Scarf',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Flower Trick', 'Knock Off', 'U-turn', 'Triple Axel'],
    },
  ],
};
