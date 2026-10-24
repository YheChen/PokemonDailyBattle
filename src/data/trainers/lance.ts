import type { Trainer } from './types';

/**
 * Lance — the Dragon master, Champion of the Indigo League in Johto. Team from the
 * HeartGold/SoulSilver Champion rematch.
 */
export const lance: Trainer = {
  id: 'lance',
  name: 'Lance',
  title: 'Champion',
  subtitle: 'Dragon master, Champion of the Indigo League',
  region: 'Johto',
  source: 'Pokémon HeartGold/SoulSilver (Champion rematch)',
  difficulty: 4,
  ai: 'champion',
  avatar: 'lance',
  arena: 'dragons-den',
  signature: 'Dragonite',
  bio: "Born to the dragon-tamer clan of Blackthorn City, Lance rose from the Kanto Elite Four to Champion of the Indigo League. He crushed Team Rocket's radio tower scheme alongside a young trainer from New Bark Town and believes dragons answer only to a trainer's heart.",
  accent: '#c0392b',
  canonical: true,
  teamNotes:
    'His HeartGold/SoulSilver rematch team. Salamence holds Salamencite; Charizard runs a special set so the two Dragon Dancers do not overlap.',
  dialogue: {
    intro: [
      "I've been waiting for you. Few trainers ever reach this room.",
      'My dragons are virtually indestructible — and they are loyal to me because of the love we share.',
      "Show me whether you have earned the right to challenge the Pokémon League's Champion!",
    ],
    playerWins: [
      "...I have nothing more to say. You are truly worthy of the title of Champion.",
      'Your Pokémon fought with a heart that even my dragons could not break. Congratulations.',
    ],
    playerLoses: [
      'As I thought — my dragons have not lost their edge.',
      'Train harder, and come back when your bond with your Pokémon is as strong as ours.',
    ],
  },
  team: [
    {
      species: 'Gyarados',
      ability: 'Moxie',
      item: 'Lum Berry',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Waterfall', 'Power Whip', 'Crunch'],
    },
    {
      species: 'Dragonite',
      ability: 'Multiscale',
      item: 'Lum Berry',
      nature: 'Adamant',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Outrage', 'Extreme Speed', 'Earthquake'],
    },
    {
      species: 'Charizard',
      ability: 'Blaze',
      item: 'Heavy-Duty Boots',
      nature: 'Timid',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Fire Blast', 'Air Slash', 'Dragon Pulse', 'Roost'],
    },
    {
      species: 'Aerodactyl',
      ability: 'Pressure',
      item: 'Focus Sash',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Stealth Rock', 'Stone Edge', 'Earthquake', 'Taunt'],
    },
    {
      species: 'Kingdra',
      ability: 'Swift Swim',
      item: 'Choice Specs',
      nature: 'Modest',
      evs: { hp: 4, spa: 252, spe: 252 },
      moves: ['Hydro Pump', 'Draco Meteor', 'Ice Beam', 'Scald'],
    },
    {
      species: 'Salamence',
      ability: 'Intimidate',
      item: 'Salamencite',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Dragon Dance', 'Double-Edge', 'Earthquake', 'Roost'],
    },
  ],
};
