/**
 * Learnset-based set builder for species without a Showdown random-battle set,
 * plus the move/ability/item pickers used to repair generator sets.
 */
import type { PRNG } from '@pkmn/sim';
import type { ModdedDex, Species, Move } from '@/lib/data/dex';
import { toId, type GenContext } from './pool';
import { RECOVERY_MOVES, SETUP_PHYSICAL, SETUP_SPECIAL } from './spreads';

const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;

/** Attacks that are traps for a naive set builder (or need a specific condition to work). */
const BAD_ATTACKS = new Set([
  'struggle', 'focuspunch', 'dreameater', 'synchronoise', 'lastresort', 'beatup', 'counter', 'mirrorcoat', 'metalburst',
  'bide', 'fling', 'naturalgift', 'present', 'frustration', 'belch', 'snore', 'sleeptalk', 'spitup', 'swallow',
  'burnup', 'doubleshock', 'rollout', 'iceball', 'uproar', 'trumpcard', 'wringout', 'crushgrip', 'punishment',
  'magnitude', 'triplekick', 'furycutter', 'echoedvoice', 'round', 'fakeout', 'skydrop', 'assist',
  'copycat', 'mefirst', 'mirrormove', 'metronome', 'naturepower', 'sketch', 'stuffcheeks', 'steelroller', 'skullbash',
  'hiddenpower', 'eruption', 'waterspout', 'dragonenergy', 'flail', 'reversal', 'electroball', 'gyroball', 'storedpower',
  'powertrip', 'terablast', 'rage', 'bind', 'wrap', 'firespin', 'clamp', 'whirlpool', 'sandtomb', 'magmastorm',
  'infestation', 'snaptrap', 'thunderfang', 'icefang', 'firefang', 'poisonfang', 'psychicfangs', 'brine', 'venoshock',
  'hex', 'avalanche', 'payback', 'revenge', 'assurance', 'lowkick', 'grassknot', 'heavyslam', 'heatcrash', 'fissure',
  'guillotine', 'horndrill', 'sheercold', 'selfdestruct', 'explosion', 'mistyexplosion', 'finalgambit', 'mindblown',
  'steelbeam', 'chloroblast', 'comeuppance', 'upperhand', 'thief', 'covet', 'bugbite', 'pluck',
  'incinerate', 'smackdown', 'superfang', 'naturesmadness', 'ruination', 'seismictoss', 'nightshade', 'bodypress',
  'foulplay', 'shellsidearm', 'endeavor', 'psywave', 'sonicboom', 'dragonrage', 'retaliate', 'feint', 'pursuit',
]);
/** Lock-in moves are fine but slightly less attractive. */
const LOCKING = new Set(['outrage', 'thrash', 'petaldance', 'ragingfury']);
/** Priority attacks are good even at lower power. */
const PRIORITY_OK = new Set(['extremespeed', 'suckerpunch', 'bulletpunch', 'machpunch', 'aquajet', 'iceshard', 'shadowsneak', 'accelerock', 'quickattack', 'jetpunch', 'vacuumwave', 'watershuriken', 'grassyglide', 'thunderclap']);

/** Base power after resolving happiness-based / fixed-formula moves we still want to use. */
export function effectivePower(m: Move): number {
  if (m.id === 'return') return 102;
  if (m.id === 'knockoff') return 97; // almost always hits an item
  if (m.id === 'facade') return 70;
  return m.basePower;
}

function accuracyFactor(m: Move): number {
  return m.accuracy === true ? 1 : m.accuracy / 100;
}

/** Is this a damaging move a set builder should consider at all? */
export function isUsableAttack(m: Move): boolean {
  if (!m.exists || m.category === 'Status' || m.isZ || m.isMax) return false;
  if (m.isNonstandard !== null && m.isNonstandard !== 'Past') return false;
  if (BAD_ATTACKS.has(m.id)) return false;
  if (m.flags.charge || m.flags.recharge || m.flags.futuremove) return false;
  if (m.selfdestruct || m.ohko || m.mindBlownRecoil) return false;
  if (effectivePower(m) <= 0) return false;
  return true;
}

/** Quality score of an attack (higher is better), ignoring type. */
export function attackScore(m: Move): number {
  let score = effectivePower(m) * accuracyFactor(m);
  if (m.multihit && Array.isArray(m.multihit)) score = Math.max(score, effectivePower(m) * 3 * accuracyFactor(m));
  if (m.recoil) score *= 0.92;
  if (m.hasCrashDamage) score *= 0.9;
  if (LOCKING.has(m.id)) score *= 0.92;
  if (m.self?.boosts) {
    const drops = Object.values(m.self.boosts).reduce((a, b) => a + Math.min(0, b ?? 0), 0);
    score *= drops <= -2 ? 0.8 : drops < 0 ? 0.93 : 1;
  }
  if (m.drain) score *= 1.08;
  if (m.priority > 0) score *= 1.25;
  if (m.secondary?.chance && m.secondary.chance >= 20) score *= 1.03;
  if (m.selfSwitch) score *= 1.05;
  return score;
}

/** Highest-quality attack of each category for the species' attacking stats. */
function preferredCategory(species: Species): 'Physical' | 'Special' {
  return species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special';
}

/** Picks one of the top candidates (weighted 4/2/1 towards the best) so sets vary between seeds. */
function pickTop<T>(prng: PRNG, ranked: T[], spread = 3): T | undefined {
  if (!ranked.length) return undefined;
  const n = Math.min(spread, ranked.length);
  const weights = [4, 2, 1].slice(0, n);
  let total = 0;
  for (const w of weights) total += w;
  let r = prng.random(total);
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r < 0) return ranked[i];
  }
  return ranked[0];
}

/** Candidate attacks from the learnset, best first. `strict` applies the power ≥ 70 / accuracy ≥ 85 bar. */
function rankedAttacks(dex: ModdedDex, learnset: Set<string>, filter: (m: Move) => boolean, strict: boolean): Move[] {
  const out: Move[] = [];
  for (const id of learnset) {
    const m = dex.moves.get(id);
    if (!isUsableAttack(m) || !filter(m)) continue;
    if (strict) {
      const okPower = effectivePower(m) >= 70 || (PRIORITY_OK.has(m.id) && effectivePower(m) >= 40);
      const okAcc = m.accuracy === true || m.accuracy >= 85;
      if (!okPower || !okAcc) continue;
    }
    out.push(m);
  }
  out.sort((a, b) => attackScore(b) - attackScore(a) || a.id.localeCompare(b.id));
  return out;
}

/** Best effectiveness (as a multiplier) that the given attack types achieve against each defending type. */
function coverageTable(dex: ModdedDex, attackTypes: string[]): Map<string, number> {
  const table = new Map<string, number>();
  for (const def of TYPES) {
    let best = 0;
    for (const atk of attackTypes) {
      const eff = dex.getImmunity(atk, [def]) ? Math.pow(2, dex.getEffectiveness(atk, [def])) : 0;
      best = Math.max(best, eff);
    }
    table.set(def, best);
  }
  return table;
}

/** How much a new attacking type improves coverage versus the current table. */
function coverageGain(dex: ModdedDex, table: Map<string, number>, type: string): number {
  let gain = 0;
  for (const def of TYPES) {
    const cur = table.get(def) ?? 0;
    const eff = dex.getImmunity(type, [def]) ? Math.pow(2, dex.getEffectiveness(type, [def])) : 0;
    if (eff > cur) gain += cur < 1 ? 2 : 1;
  }
  return gain;
}

export type FallbackRole = 'attacker' | 'defensive';

/** Decides whether the species should be built as an attacker or a defensive Pokémon. */
export function fallbackRole(species: Species, learnset: Set<string>): FallbackRole {
  const b = species.baseStats;
  const offense = Math.max(b.atk, b.spa);
  const bulk = b.hp + b.def + b.spd;
  const hasRecovery = [...learnset].some((id) => RECOVERY_MOVES.has(id));
  if (offense >= 100 || b.spe >= 95) return 'attacker';
  if (bulk >= 270 && (hasRecovery || offense < 80)) return 'defensive';
  if (offense >= 80) return 'attacker';
  return bulk > offense * 3 ? 'defensive' : 'attacker';
}

/** Abilities we never want, with a large negative score. */
const ABILITY_SCORES: Record<string, number> = {
  truant: -100, slowstart: -100, defeatist: -100, stall: -90, klutz: -80, normalize: -60, illuminate: -30, runaway: -30,
  honeygather: -30, ballfetch: -30, pickup: -25, frisk: -10, anticipation: -10, forewarn: -10, keeneye: -15, bigpecks: -15,
  oblivious: -10, owntempo: -5, tangledfeet: -10, stench: -15, damp: -10, cutecharm: -15, rivalry: -5, unnerve: 0,
  insomnia: 5, vitalspirit: 5, innerfocus: 5, steadfast: 5, rattled: 0, healer: -10, friendguard: -20, telepathy: -15,
  plus: -5, minus: -5, flowergift: -10, flowerveil: -10, symbiosis: -20, receiver: -20, powerofalchemy: -20, battery: -10,
  leafguard: -5, hydration: 0, overcoat: 5, aftermath: 5, earlybird: 0, limber: 10, waterveil: 10, magmaarmor: 0,
  // Strong abilities.
  hugepower: 100, purepower: 100, speedboost: 95, protean: 90, libero: 90, adaptability: 85, magicguard: 85,
  multiscale: 85, shadowshield: 85, regenerator: 80, intimidate: 75, drought: 70, drizzle: 70, sandstream: 65,
  snowwarning: 60, technician: 75, sheerforce: 75, toughclaws: 75, levitate: 60, unaware: 70, prankster: 70, serenegrace: 60, guts: 65, moxie: 60, beastboost: 70, magicbounce: 75, thickfat: 55, waterabsorb: 55,
  voltabsorb: 55, flashfire: 55, sapsipper: 55, poisonheal: 80, sturdy: 45, moldbreaker: 50, teravolt: 50, turboblaze: 50,
  skilllink: 65, strongjaw: 55, megalauncher: 55, ironfist: 50, reckless: 55, rockhead: 50, chlorophyll: 45, swiftswim: 45,
  sandrush: 45, slushrush: 45, surgesurfer: 40, contrary: 70, simple: 55, unburden: 55, tintedlens: 60, scrappy: 50,
  noguard: 50, compoundeyes: 50, furcoat: 80, fluffy: 60, icescales: 75, filter: 50, solidrock: 50, prismarmor: 50,
  naturalcure: 45, shedskin: 40, immunity: 35, stormdrain: 50, lightningrod: 50, motordrive: 45, eartheater: 55,
  wellbakedbody: 50, purifyingsalt: 60, goodasgold: 70, supremeoverlord: 55, quarkdrive: 65, protosynthesis: 65,
  orichalcumpulse: 85, hadronengine: 85, swordofruin: 70, beadsofruin: 70, tabletsofruin: 60, vesselofruin: 60,
  disguise: 75, wonderguard: 50, parentalbond: 95, galewings: 60, triage: 60, waterbubble: 80, steelworker: 55,
  dragonsmaw: 60, transistor: 60, toxicboost: 55, flareboost: 50, queenlymajesty: 45, dazzling: 45, armortail: 45,
  mirrorarmor: 55, neutralizinggas: 40, pastelveil: 30, punkrock: 45, sandspit: 30, hungerswitch: 20, electricsurge: 55,
  psychicsurge: 55, grassysurge: 55, mistysurge: 45, sharpness: 65, rockypayload: 55, toxicchain: 65, opportunist: 50,
  cudchew: 35, windrider: 40, guarddog: 40, thermalexchange: 45, stamina: 55, berserk: 45, competitive: 45, defiant: 55,
  justified: 35, analytic: 45, download: 50, hustle: 35, pixilate: 65, aerilate: 65, refrigerate: 65, galvanize: 65, solarpower: 35, flamebody: 30, static: 30, roughskin: 40, ironbarbs: 40, pressure: 20, snowcloak: 20,
  sandveil: 20, swarm: 25, blaze: 25, torrent: 25, overgrow: 25, marvelscale: 45, battlearmor: 25, shellarmor: 25,
  clearbody: 35, whitesmoke: 35, fullmetalbody: 35, hypercutter: 25, superluck: 30, sniper: 30, poisontouch: 30,
  poisonpoint: 25, effectspore: 25, cursedbody: 35, infiltrator: 30, weakarmor: 25, stancechange: 90, schooling: 60,
  shieldsdown: 60, battlebond: 55, powerconstruct: 70, zenmode: 10, gulpmissile: 40, iceface: 60, zerotohero: 80,
  commander: 0, embodyaspectteal: 40, poisonpuppeteer: 60, mindseye: 35, supersweetsyrup: 35,
  hospitality: 10, toxicdebris: 45, seedsower: 35, electromorphosis: 35, angershell: 45, cottondown: 30, ripen: 25,
  steamengine: 35, mimicry: 25, dauntlessshield: 50, intrepidsword: 60, gorillatactics: 55, quickfeet: 40,
  tanglinghair: 35, gooey: 35, liquidooze: 20, innardsout: 15, emergencyexit: 10, wimpout: 10, stakeout: 50, merciless: 35,
  liquidvoice: 25, soundproof: 30, bulletproof: 40, heatproof: 40, watercompaction: 20,
  magnetpull: 40, arenatrap: 50, shadowtag: 60, trace: 30, imposter: 60, illusion: 45, moody: 40, harvest: 50, sweetveil: 25,
  cheekpouch: 30, aromaveil: 25, longreach: 25, dancer: 35, stalwart: 25, propellertail: 25, screencleaner: 20, steelyspirit: 30, perishbody: 10, wanderingspirit: 25, icebody: 15, raindish: 15, dryskin: 20,
  sandforce: 35, grasspelt: 25, victorystar: 30, lingeringaroma: 25, costar: 10, synchronize: 25, heavymetal: 15,
  lightmetal: 15, magician: 25, pickpocket: 25, stickyhold: 15, suctioncups: 20, airlock: 30,
  cloudnine: 30, forecast: 10, multitype: 50, rkssystem: 50, colorchange: 20,
};

/** Legal abilities for the species that exist in the gen 9 dex, best first. Ties keep slot order. */
export function rankAbilities(dex: ModdedDex, species: Species): string[] {
  const names = Object.values(species.abilities).filter((a): a is Exclude<typeof a, ''> => !!a);
  const legal = names.filter((name) => {
    const a = dex.abilities.get(name);
    return a.exists && (a.isNonstandard === null || a.isNonstandard === 'Past');
  });
  const scored = legal.map((name, i) => ({ name, score: ABILITY_SCORES[toId(name)] ?? 10, i }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((s) => s.name);
}

/** Is the ability legal for this species in the gen 9 dex? */
export function isLegalAbility(dex: ModdedDex, species: Species, ability: string): boolean {
  const id = toId(ability);
  if (!id) return false;
  return rankAbilities(dex, species).some((a) => toId(a) === id);
}

/** Items that a species must hold to exist in that form. */
export function requiredItem(species: Species): string | undefined {
  if (species.requiredItem) return species.requiredItem;
  if (species.requiredItems?.length) return species.requiredItems[0];
  return undefined;
}

/** Sensible competitive item by role, speed and moves. */
export function chooseItem(
  dex: ModdedDex,
  species: Species,
  moveIds: string[],
  role: FallbackRole,
  ability: string,
  prng: PRNG,
): string {
  const req = requiredItem(species);
  if (req) return req;
  if (species.id === 'pikachu') return 'Light Ball';
  if (species.id === 'marowak' || species.id === 'marowakalola' || species.id === 'cubone') return 'Thick Club';
  if (species.id === 'ditto') return 'Choice Scarf';
  if (toId(ability) === 'magicguard' || toId(ability) === 'sheerforce') return 'Life Orb';
  if (toId(ability) === 'poisonheal') return 'Toxic Orb';
  if (toId(ability) === 'guts' || toId(ability) === 'quickfeet') return 'Flame Orb';
  if (species.nfe && role === 'defensive') return 'Eviolite';
  if (species.nfe && species.baseStats.hp + species.baseStats.def + species.baseStats.spd >= 180) return 'Eviolite';
  const b = species.baseStats;
  const attacks = moveIds.filter((id) => dex.moves.get(id).category !== 'Status');
  const hasSetup = moveIds.some((id) => SETUP_PHYSICAL.has(id) || SETUP_SPECIAL.has(id));
  const hasRecovery = moveIds.some((id) => RECOVERY_MOVES.has(id));
  const physical = attacks.filter((id) => dex.moves.get(id).category === 'Physical').length >= attacks.length / 2;
  const frail = b.hp + b.def + b.spd < 210;
  const rockWeak = dex.getEffectiveness('Rock', species.types) > 0;
  if (role === 'defensive') {
    if (rockWeak && !hasRecovery) return 'Heavy-Duty Boots';
    return prng.randomChance(1, 4) ? 'Rocky Helmet' : 'Leftovers';
  }
  if (attacks.length === 4) {
    if (b.spe >= 60 && b.spe < 100 && prng.randomChance(1, 2)) return 'Choice Scarf';
    if (b.hp + b.spd >= 180 && b.spe < 70 && !physical) return 'Assault Vest';
    if (b.spe < 70) return physical ? 'Choice Band' : 'Choice Specs';
    if (frail && b.spe >= 100 && prng.randomChance(1, 3)) return 'Focus Sash';
    return prng.randomChance(1, 3) ? (physical ? 'Choice Band' : 'Choice Specs') : 'Life Orb';
  }
  if (hasSetup) {
    if (frail && b.spe >= 95 && prng.randomChance(1, 4)) return 'Focus Sash';
    return b.hp + b.def + b.spd >= 260 ? 'Leftovers' : 'Life Orb';
  }
  if (rockWeak) return 'Heavy-Duty Boots';
  if (hasRecovery) return 'Leftovers';
  return prng.randomChance(1, 2) ? 'Life Orb' : 'Leftovers';
}

/** Utility moves ranked for a role; returns ids present in the learnset. */
function utilityCandidates(species: Species, learnset: Set<string>, role: FallbackRole, category: 'Physical' | 'Special'): string[] {
  const has = (id: string) => learnset.has(id);
  const setup = category === 'Physical'
    ? ['swordsdance', 'dragondance', 'shellsmash', 'bulkup', 'coil', 'shiftgear', 'victorydance', 'honeclaws', 'bellydrum', 'tidyup', 'curse', 'howl', 'workup']
    : ['nastyplot', 'quiverdance', 'shellsmash', 'calmmind', 'tailglow', 'geomancy', 'takeheart', 'agility', 'workup', 'growth'];
  const recovery = ['recover', 'roost', 'slackoff', 'softboiled', 'synthesis', 'moonlight', 'morningsun', 'shoreup', 'milkdrink', 'strengthsap', 'wish', 'painsplit', 'rest'];
  const support = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'willowisp', 'thunderwave', 'toxic', 'leechseed', 'knockoff', 'defog', 'rapidspin', 'haze', 'whirlwind', 'roar', 'encore', 'taunt', 'protect', 'substitute', 'spore', 'sleeppowder', 'glare', 'stunspore', 'yawn', 'healbell', 'aromatherapy', 'reflect', 'lightscreen', 'bodypress'];
  const pivot = ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport'];
  const order = role === 'attacker'
    ? [...setup, ...pivot, 'knockoff', 'substitute', 'protect', ...recovery, 'stealthrock', 'willowisp', 'thunderwave', 'toxic', 'taunt']
    : [...recovery, ...support, ...pivot, ...(species.baseStats.def >= species.baseStats.spd ? ['irondefense', 'bodypress'] : ['amnesia', 'calmmind'])];
  // Curse is only setup for non-Ghosts.
  const out: string[] = [];
  for (const id of order) {
    if (!has(id) || out.includes(id)) continue;
    if (id === 'curse' && species.types.includes('Ghost')) continue;
    if (id === 'rest' && !has('sleeptalk') && role === 'attacker') continue;
    out.push(id);
  }
  return out;
}

export interface BuiltSet {
  moves: string[];
  ability: string;
  item: string;
}

/**
 * Builds a sensible moveset / ability / item for any species from its learnset.
 * Always returns exactly 4 distinct, learnable move ids (the pool guarantees ≥ 4 learnable moves).
 */
export async function buildFallbackSet(ctx: GenContext, species: Species, prng: PRNG): Promise<BuiltSet> {
  const { dex } = ctx;
  const learnset = await ctx.learnset(species.id);
  const role = fallbackRole(species, learnset);
  const category = preferredCategory(species);
  const otherCategory = category === 'Physical' ? 'Special' : 'Physical';
  const moves: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !moves.includes(id) && moves.length < 4) moves.push(id);
  };
  const req = species.requiredMove ? toId(species.requiredMove) : '';
  if (req && learnset.has(req)) add(req);

  // 1. STAB: one attack per type on the better attacking stat (fall back to the other stat, then relax power/accuracy).
  const stabTypes = [...new Set(species.types)];
  for (const type of stabTypes) {
    const byType = (m: Move) => m.type === type;
    const tiers: Move[][] = [
      rankedAttacks(dex, learnset, (m) => byType(m) && m.category === category, true),
      rankedAttacks(dex, learnset, (m) => byType(m) && m.category === otherCategory, true),
      rankedAttacks(dex, learnset, byType, false),
    ];
    for (const tier of tiers) {
      const choice = pickTop(prng, tier.filter((m) => !moves.includes(m.id)), 2);
      if (choice) { add(choice.id); break; }
    }
  }
  // Monotype attackers: a second STAB of a different flavour (priority / different category) is often worth it.
  if (stabTypes.length === 1 && role === 'attacker' && moves.length < 4) {
    const extra = rankedAttacks(dex, learnset, (m) => m.type === stabTypes[0] && !moves.includes(m.id) && (m.priority > 0 || m.selfSwitch === true), true);
    if (extra.length && prng.randomChance(1, 2)) add(extra[0].id);
  }

  // 2. Coverage: attacks whose type hits what the current attacks don't.
  const coverageSlots = role === 'attacker' ? 2 : 1;
  for (let i = 0; i < coverageSlots && moves.length < 4; i++) {
    const table = coverageTable(dex, moves.map((id) => dex.moves.get(id)).filter((m) => m.category !== 'Status').map((m) => m.type));
    const pick = (strict: boolean, cat?: 'Physical' | 'Special') => {
      const cands = rankedAttacks(dex, learnset, (m) => !moves.includes(m.id) && !stabTypes.includes(m.type) && (!cat || m.category === cat), strict)
        .map((m) => ({ m, gain: coverageGain(dex, table, m.type) }))
        .filter((c) => c.gain > 0)
        .sort((a, b) => b.gain - a.gain || attackScore(b.m) - attackScore(a.m) || a.m.id.localeCompare(b.m.id));
      return pickTop(prng, cands, 3)?.m;
    };
    const choice = pick(true, category) ?? pick(true) ?? pick(false, category) ?? pick(false);
    if (!choice) break;
    add(choice.id);
  }

  // 3. Utility / setup / recovery by role (defensive sets get two).
  const utilSlots = role === 'attacker' ? 1 : 2;
  const utils = utilityCandidates(species, learnset, role, category).filter((id) => !moves.includes(id));
  for (let i = 0; i < utilSlots && moves.length < 4; i++) {
    // Favour the top of the list but let the seed vary it a little; one recovery move is enough.
    const hasRecovery = moves.some((id) => RECOVERY_MOVES.has(id));
    const choice = pickTop(prng, utils.filter((id) => !moves.includes(id) && !(hasRecovery && RECOVERY_MOVES.has(id))), 2);
    add(choice);
  }

  // 4. Fill remaining slots: best remaining attacks (any type), then any utility, then anything learnable.
  if (moves.length < 4) {
    const rest = rankedAttacks(dex, learnset, (m) => !moves.includes(m.id), false);
    for (const m of rest) add(m.id);
  }
  if (moves.length < 4) for (const id of utils) add(id);
  if (moves.length < 4) {
    const any = [...learnset].filter((id) => !moves.includes(id)).sort();
    for (const id of any) add(id);
  }

  const abilities = rankAbilities(dex, species);
  // Keep the ranking but allow the seed to pick the runner-up when it's nearly as good.
  let ability = abilities[0] ?? 'No Ability';
  if (abilities.length > 1) {
    const s0 = ABILITY_SCORES[toId(abilities[0])] ?? 10;
    const s1 = ABILITY_SCORES[toId(abilities[1])] ?? 10;
    if (s1 >= s0 - 5 && s1 >= 0 && prng.randomChance(1, 3)) ability = abilities[1];
  }
  const item = chooseItem(dex, species, moves, role, ability, prng);
  return { moves, ability, item };
}

/**
 * Replacement for an illegal move in a generator set: a coverage attack the set lacks, else a utility move,
 * else the best remaining attack, else any learnable move. Never returns a move already in `current`.
 */
export async function pickReplacementMove(ctx: GenContext, species: Species, current: string[], prng: PRNG): Promise<string> {
  const { dex } = ctx;
  const learnset = await ctx.learnset(species.id);
  const have = new Set(current.map(toId));
  const attacks = current.map((id) => dex.moves.get(toId(id))).filter((m) => m.exists && m.category !== 'Status');
  // Match the category the set already attacks with (a special attacker must not get a physical filler).
  const physicalCount = attacks.filter((m) => m.category === 'Physical').length;
  const specialCount = attacks.length - physicalCount;
  const category: 'Physical' | 'Special' =
    physicalCount === specialCount ? preferredCategory(species) : physicalCount > specialCount ? 'Physical' : 'Special';
  const table = coverageTable(dex, attacks.map((m) => m.type));
  const rank = (filter: (m: Move) => boolean, strict: boolean) =>
    rankedAttacks(dex, learnset, (m) => !have.has(m.id) && filter(m), strict)
      .map((m) => ({ m, gain: coverageGain(dex, table, m.type) + (species.types.includes(m.type) ? 1 : 0) }))
      .sort((a, b) => b.gain - a.gain || attackScore(b.m) - attackScore(a.m) || a.m.id.localeCompare(b.m.id));
  const sameCategory = rank((m) => m.category === category, true);
  const cands = sameCategory.length ? sameCategory : rank(() => true, true);
  if (attacks.length < 3 && cands.length) return pickTop(prng, cands, 2)!.m.id;
  const role = fallbackRole(species, learnset);
  const utils = utilityCandidates(species, learnset, role, category).filter((id) => !have.has(id));
  if (utils.length) return pickTop(prng, utils, 2)!;
  if (cands.length) return cands[0].m.id;
  const rest = rankedAttacks(dex, learnset, (m) => !have.has(m.id), false);
  if (rest.length) return rest[0].id;
  const any = [...learnset].filter((id) => !have.has(id)).sort();
  if (!any.length) throw new Error(`No replacement move available for ${species.name}`);
  return any[0];
}

/** Does the learnset contain the move (Hidden Power variants count as Hidden Power)? */
export function canLearn(learnset: Set<string>, moveId: string): boolean {
  if (learnset.has(moveId)) return true;
  if (moveId.startsWith('hiddenpower') && learnset.has('hiddenpower')) return true;
  return false;
}
