/**
 * Validates trainer teams against the Gen 9 (National Dex) data:
 * species/ability/item/move existence, learnset membership, ability legality, 4 distinct moves,
 * distinct species per team, EV totals ≤ 510 and ≤ 252 per stat, signature on team, dialogue present.
 *
 * Usage: npm run validate:trainers            (all trainers; missing files are reported)
 *        npm run validate:trainers -- red cynthia   (only these ids)
 */
import { Dex } from '@pkmn/dex';
import type { Trainer } from '../src/data/trainers/types';

const ALL_IDS = [
  'red', 'blue', 'cynthia', 'steven', 'wallace', 'lance', 'alder', 'iris', 'diantha', 'leon', 'geeta', 'nemona',
  'giovanni', 'n', 'ghetsis', 'silver', 'wally', 'oak', 'kukui', 'volo', 'arven', 'penny', 'kieran',
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ids = only.length ? only : ALL_IDS;
const dex = Dex.forGen(9);
const problems: string[] = [];
let validated = 0;

async function learnset(speciesId: string): Promise<Set<string>> {
  const moves = new Set<string>();
  let species = dex.species.get(speciesId);
  const seen = new Set<string>();
  while (species && species.exists && !seen.has(species.id)) {
    seen.add(species.id);
    const ls = await dex.learnsets.get(species.id);
    for (const id of Object.keys(ls?.learnset ?? {})) moves.add(id);
    if (species.forme && species.baseSpecies && species.baseSpecies !== species.name) {
      const bls = await dex.learnsets.get(dex.species.get(species.baseSpecies).id);
      for (const id of Object.keys(bls?.learnset ?? {})) moves.add(id);
    }
    species = species.prevo ? dex.species.get(species.prevo) : (undefined as never);
  }
  return moves;
}

for (const id of ids) {
  let trainer: Trainer;
  try {
    const mod = (await import(`../src/data/trainers/${id}.ts`)) as Record<string, Trainer>;
    trainer = mod[id] ?? Object.values(mod)[0];
    if (!trainer) throw new Error('no export');
  } catch (e) {
    problems.push(`${id}: cannot load src/data/trainers/${id}.ts (${(e as Error).message.split('\n')[0]})`);
    continue;
  }
  validated++;
  const where = `${trainer.id}`;
  if (trainer.id !== id) problems.push(`${where}: id should be "${id}"`);
  if (trainer.team.length !== 6) problems.push(`${where}: team must have 6 Pokémon`);
  const baseSpecies = new Set<string>();
  for (const p of trainer.team) {
    const s = dex.species.get(p.species);
    const tag = `${where} / ${p.species}`;
    if (!s.exists) { problems.push(`${tag}: unknown species`); continue; }
    if (s.isNonstandard && s.isNonstandard !== 'Past') problems.push(`${tag}: nonstandard species (${s.isNonstandard})`);
    if (s.battleOnly) problems.push(`${tag}: battle-only forme (use the base forme)`);
    if (baseSpecies.has(s.baseSpecies)) problems.push(`${tag}: duplicate species in team`);
    baseSpecies.add(s.baseSpecies);
    const abilities = Object.values(s.abilities) as string[];
    if (!abilities.includes(p.ability)) problems.push(`${tag}: ability "${p.ability}" not in ${abilities.join('/')}`);
    const item = dex.items.get(p.item);
    if (p.item && !item.exists) problems.push(`${tag}: unknown item "${p.item}"`);
    if (item.exists && item.isNonstandard && item.isNonstandard !== 'Past') problems.push(`${tag}: nonstandard item ${p.item}`);
    if (item.exists && item.megaStone && !(s.baseSpecies in item.megaStone) && !(s.name in item.megaStone)) problems.push(`${tag}: ${p.item} does not mega evolve ${s.name}`);
    if (!dex.natures.get(p.nature).exists) problems.push(`${tag}: unknown nature ${p.nature}`);
    const evTotal = Object.values(p.evs).reduce((a, b) => a + (b ?? 0), 0);
    if (evTotal > 510) problems.push(`${tag}: EV total ${evTotal} > 510`);
    for (const [k, v] of Object.entries(p.evs)) if ((v ?? 0) > 252) problems.push(`${tag}: ${k} EVs ${v} > 252`);
    if (new Set(p.moves.map((m) => dex.moves.get(m).id)).size !== 4) problems.push(`${tag}: needs 4 distinct moves`);
    const ls = await learnset(s.id);
    for (const m of p.moves) {
      const move = dex.moves.get(m);
      if (!move.exists) { problems.push(`${tag}: unknown move "${m}"`); continue; }
      if (move.isNonstandard && move.isNonstandard !== 'Past') problems.push(`${tag}: nonstandard move ${m}`);
      if (!ls.has(move.id)) problems.push(`${tag}: ${s.name} cannot learn ${move.name}`);
    }
    if (p.teraType && !dex.types.get(p.teraType).exists) problems.push(`${tag}: bad tera type ${p.teraType}`);
  }
  const sig = dex.species.get(trainer.signature);
  if (!sig.exists) problems.push(`${where}: unknown signature species ${trainer.signature}`);
  else if (!trainer.team.some((p) => dex.species.get(p.species).baseSpecies === sig.baseSpecies)) {
    problems.push(`${where}: signature ${trainer.signature} is not on the team`);
  }
  if (!trainer.dialogue?.intro?.length || !trainer.dialogue?.playerWins?.length || !trainer.dialogue?.playerLoses?.length) {
    problems.push(`${where}: dialogue missing`);
  }
  if (!trainer.avatar) problems.push(`${where}: avatar missing`);
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`✓ ${validated} trainer(s) validated (${validated * 6} sets)`);
