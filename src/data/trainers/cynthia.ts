import type { Trainer } from './types';

/**
 * Cynthia — Champion of the Sinnoh League. Team from Pokémon Diamond/Pearl.
 */
export const cynthia: Trainer = {
  id: 'cynthia',
  name: 'Cynthia',
  title: 'Champion',
  subtitle: 'Champion of the Sinnoh League',
  region: 'Sinnoh',
  source: 'Pokémon Diamond/Pearl (Pokémon League)',
  difficulty: 5,
  ai: 'champion',
  avatar: 'cynthia',
  arena: 'sinnoh-league',
  signature: 'Garchomp',
  bio: "A scholar of Sinnoh's myths and the most feared Champion in the franchise. Calm and gracious outside of battle, Cynthia fights with surgical precision, and her Garchomp has ended more challenges than any Pokémon in the region.",
  accent: '#3b3b8f',
  canonical: true,
  teamNotes: 'Her Diamond/Pearl Champion team, unchanged.',
  dialogue: {
    intro: [
      "I've been looking forward to this. You've come a long way to stand here.",
      'Every trainer who reaches me carries their own story. Let me see the strength yours has given you.',
      'I will hold nothing back. Show me everything you have!',
    ],
    playerWins: [
      "That was... the battle I've been waiting for. You and your Pokémon are magnificent.",
      "The title is yours. Carry it with the same heart you showed me today.",
    ],
    playerLoses: [
      'Your Pokémon fought beautifully, but the bond between us was stronger today.',
      'Go, keep traveling, keep learning. I will be here when you return.',
    ],
  },
  team: [
    {
      species: 'Spiritomb',
      ability: 'Pressure',
      item: 'Leftovers',
      nature: 'Bold',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Will-O-Wisp', 'Foul Play', 'Pain Split', 'Sucker Punch'],
    },
    {
      species: 'Roserade',
      ability: 'Natural Cure',
      item: 'Life Orb',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Leaf Storm', 'Sludge Bomb', 'Sleep Powder', 'Spikes'],
    },
    {
      species: 'Gastrodon',
      ability: 'Storm Drain',
      item: 'Leftovers',
      nature: 'Calm',
      evs: { hp: 252, def: 4, spd: 252 },
      moves: ['Scald', 'Earth Power', 'Recover', 'Toxic'],
    },
    {
      species: 'Lucario',
      ability: 'Justified',
      item: 'Life Orb',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Swords Dance', 'Close Combat', 'Extreme Speed', 'Meteor Mash'],
    },
    {
      species: 'Milotic',
      ability: 'Marvel Scale',
      item: 'Leftovers',
      nature: 'Bold',
      evs: { hp: 252, def: 252, spd: 4 },
      moves: ['Scald', 'Recover', 'Ice Beam', 'Haze'],
    },
    {
      species: 'Garchomp',
      ability: 'Rough Skin',
      item: 'Loaded Dice',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Swords Dance', 'Earthquake', 'Scale Shot', 'Stone Edge'],
    },
  ],
};
