import type { SideID } from '@pkmn/sim';
import type { ChoiceRequest } from './types';

/** Party entry as it appears in `request.side.pokemon`. */
export interface RequestPokemon {
  active: boolean;
  condition: string;
  /** Set by the engine on the active entry after Revival Blessing resolved: the switch must target a FAINTED ally. */
  reviving?: boolean;
}

export function isFaintedCondition(condition: string): boolean {
  return condition.endsWith(' fnt') || condition === '0 fnt';
}

/**
 * Is a Revival Blessing switch pending? The engine then only accepts `switch N` where N is a fainted,
 * non-active party member (it is revived to half HP and stays on the bench).
 */
export function isRevivingRequest(request: ChoiceRequest | null | undefined): boolean {
  if (!request || !request.forceSwitch) return false;
  return request.side.pokemon.some((p: RequestPokemon) => p.active && !!p.reviving);
}

/** Is this party entry a legal switch target? With `reviving`, the targets are the fainted bench members instead. */
export function canSwitchTo(p: RequestPokemon, reviving = false): boolean {
  if (p.active) return false;
  const fainted = isFaintedCondition(p.condition);
  return reviving ? fainted : !fainted;
}

/**
 * Enumerates every choice string that the Showdown engine would accept for a singles request.
 * Index semantics follow Showdown: moves are 1-based into request.active[0].moves,
 * switches are 1-based into request.side.pokemon.
 */
export function listLegalChoices(request: ChoiceRequest | null | undefined): string[] {
  if (!request || request.wait) return [];
  if (request.teamPreview) {
    return [`team ${request.side.pokemon.map((_p, i: number) => i + 1).join('')}`];
  }
  const reviving = isRevivingRequest(request);
  const switches = request.side.pokemon
    .map((p, i: number) => ({ p, i }))
    .filter(({ p }) => canSwitchTo(p, reviving))
    .map(({ i }) => `switch ${i + 1}`);
  if (request.forceSwitch) {
    // Revival Blessing only resolves when an ally is fainted, so `switches` is never empty while reviving;
    // `pass` is the engine's answer to a forced switch with nobody left to send in.
    return switches.length ? switches : ['pass'];
  }
  const active = request.active?.[0];
  if (!active) return switches;
  const choices: string[] = [];
  const moves = active.moves ?? [];
  const usable = moves.map((m, i: number) => ({ m, i })).filter(({ m }) => !m.disabled);
  for (const { i } of usable) {
    choices.push(`move ${i + 1}`);
    if (active.canMegaEvo || active.canMegaEvoX || active.canMegaEvoY) choices.push(`move ${i + 1} mega`);
    if (active.canUltraBurst) choices.push(`move ${i + 1} ultra`);
    if (active.canTerastallize) choices.push(`move ${i + 1} terastallize`);
    const z = active.canZMove?.[i];
    if (z) choices.push(`move ${i + 1} zmove`);
  }
  // Struggle: no usable moves → the engine accepts "move 1" (it maps to Struggle).
  if (!usable.length && moves.length) choices.push('move 1');
  if (!active.trapped) choices.push(...switches);
  return choices;
}

/** First legal choice, preferring a move over a switch (never returns undefined for a non-wait request). */
export function firstLegalChoice(request: ChoiceRequest | null | undefined): string | null {
  const all = listLegalChoices(request);
  if (!all.length) return null;
  return all.find((c) => c.startsWith('move ') && !c.includes(' ', 5)) ?? all[0];
}

export function otherSide(side: SideID): SideID {
  return side === 'p1' ? 'p2' : 'p1';
}
