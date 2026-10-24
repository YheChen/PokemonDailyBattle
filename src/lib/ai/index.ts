/**
 * Opponent AI entry point.
 *
 * `createOpponentAI(difficulty)` returns an `OpponentAgent` whose `choose(ctx)` scores every legal choice for the
 * current request (see `evaluate.ts`) and returns the best one. The answer is always a member of
 * `listLegalChoices(ctx.request)`, the decision is deterministic given the battle state and `ctx.prng`, and nothing in
 * the battle is mutated, so the session can replay logged choices to restore a saved battle.
 */
import type { AIContext, Difficulty, OpponentAgent } from '@/lib/battle/types';
import { firstLegalChoice, listLegalChoices } from '@/lib/battle/legal';
import { scoreActions, type ScoredAction } from './evaluate';

export type { AIContext, OpponentAgent, Difficulty } from '@/lib/battle/types';
export { scoreActions } from './evaluate';
export type { ScoredAction } from './evaluate';
export { DamageModel, type DamageEstimate } from './damage';

export const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard', 'champion'];

/** Picks the best legal choice from a scored list (the list is sorted best-first by `scoreActions`). */
export function pickChoice(actions: readonly ScoredAction[], legal: readonly string[]): string | null {
  if (!legal.length) return null;
  const legalSet = new Set(legal);
  const best = actions.find((a) => legalSet.has(a.choice));
  if (best) return best.choice;
  return legal.find((c) => c.startsWith('move ') && !c.includes(' ', 5)) ?? legal[0];
}

export interface OpponentAIOptions {
  /**
   * Propagate evaluation errors instead of falling back to the first legal choice. Off by default so a battle
   * never hangs on an exotic state; tests turn it on so a crash can never hide behind the fallback.
   */
  strict?: boolean;
}

class ScoringAgent implements OpponentAgent {
  constructor(readonly difficulty: Difficulty, private readonly strict: boolean) {}

  choose(ctx: AIContext): string {
    const legal = listLegalChoices(ctx.request);
    if (!legal.length) return 'default';
    const context: AIContext = { ...ctx, difficulty: this.difficulty };
    let actions: ScoredAction[] = [];
    try {
      actions = scoreActions(context);
    } catch (err) {
      if (this.strict) throw err;
      actions = [];
    }
    return pickChoice(actions, legal) ?? firstLegalChoice(ctx.request) ?? 'default';
  }
}

export function createOpponentAI(difficulty: Difficulty, options: OpponentAIOptions = {}): OpponentAgent {
  return new ScoringAgent(DIFFICULTIES.includes(difficulty) ? difficulty : 'hard', !!options.strict);
}
