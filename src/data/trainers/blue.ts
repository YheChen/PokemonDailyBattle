import type { Trainer } from './types';

/**
 * Blue — Red's rival, the Champion who lost his title minutes after winning it,
 * now Viridian City's Gym Leader. Team from FireRed/LeafGreen & HeartGold/SoulSilver.
 */
export const blue: Trainer = {
  id: 'blue',
  name: 'Blue',
  title: 'Champion',
  subtitle: 'Former Champion, Viridian Gym Leader',
  region: 'Kanto',
  source: 'Pokémon FireRed/LeafGreen & HeartGold/SoulSilver (Viridian Gym)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'blue',
  arena: 'indigo-plateau',
  signature: 'Pidgeot',
  bio: "Professor Oak's grandson and the first trainer to ever beat the Indigo Elite Four — for all of a few minutes. Cocky, fast-talking and relentlessly competitive, he has grown into one of Kanto's most dangerous trainers.",
  accent: '#2e6fd8',
  canonical: false,
  teamNotes:
    'His Viridian Gym team with Rhydon evolved into Rhyperior. Pidgeot holds Pidgeotite so its Hurricanes never miss.',
  dialogue: {
    intro: [
      "Hey! I was wondering who'd come knocking. Figures it'd be you.",
      "I've been training since the day I lost the title. Smell ya later? Not this time.",
      "Let's see how your Pokémon stack up against a real Champion's!",
    ],
    playerWins: [
      'What?! My Pokémon... lost?',
      "...Fine. You win this one. But I'll catch up to you, count on it!",
    ],
    playerLoses: [
      "Ha! That's what you get for challenging me!",
      "Go train some more. Then come back and I'll beat you again. Smell ya later!",
    ],
  },
  team: [
    {
      species: 'Pidgeot',
      ability: 'Keen Eye',
      item: 'Pidgeotite',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Hurricane', 'Heat Wave', 'U-turn', 'Roost'],
    },
    {
      species: 'Alakazam',
      ability: 'Magic Guard',
      item: 'Life Orb',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Nasty Plot', 'Psychic', 'Focus Blast', 'Shadow Ball'],
    },
    {
      species: 'Rhyperior',
      ability: 'Solid Rock',
      item: 'Leftovers',
      nature: 'Adamant',
      evs: { hp: 252, atk: 252, def: 4 },
      moves: ['Earthquake', 'Stone Edge', 'Megahorn', 'Stealth Rock'],
    },
    {
      species: 'Gyarados',
      ability: 'Moxie',
      item: 'Lum Berry',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Waterfall', 'Bounce', 'Earthquake'],
    },
    {
      species: 'Arcanine',
      ability: 'Intimidate',
      item: 'Choice Band',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Flare Blitz', 'Extreme Speed', 'Close Combat', 'Wild Charge'],
    },
    {
      species: 'Exeggutor',
      ability: 'Harvest',
      item: 'Sitrus Berry',
      nature: 'Modest',
      evs: { hp: 252, def: 4, spa: 252 },
      moves: ['Giga Drain', 'Psyshock', 'Sludge Bomb', 'Leech Seed'],
    },
  ],
};
