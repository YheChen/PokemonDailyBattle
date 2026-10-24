import { listLegalChoices } from './legal';
import type { AIContext, OpponentAgent } from './types';

/**
 * Default opponent when no AI is supplied: picks uniformly among the legal choices using the
 * session's PRNG (deterministic for a given battle seed). The strategic AI lives in `src/lib/ai`.
 */
export class RandomAgent implements OpponentAgent {
  choose(ctx: AIContext): string {
    const choices = listLegalChoices(ctx.request);
    if (!choices.length) return 'default';
    return ctx.prng.sample(choices);
  }
}
