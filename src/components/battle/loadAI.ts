/**
 * Loads the opponent AI lazily. The AI module is optional at build time (another part of the project
 * may still be in progress): when it cannot be loaded the session falls back to its built-in agent.
 */
import type { Difficulty, OpponentAgent } from '@/lib/battle/types';

type AIModule = { createOpponentAI?: (difficulty: Difficulty) => OpponentAgent };

export async function loadOpponentAI(difficulty: Difficulty): Promise<OpponentAgent | undefined> {
  try {
    const mod = (await import(/* turbopackOptional: true */ '@/lib/ai')) as unknown as AIModule;
    if (typeof mod.createOpponentAI !== 'function') return undefined;
    const agent = mod.createOpponentAI(difficulty);
    return agent && typeof agent.choose === 'function' ? agent : undefined;
  } catch (err) {
    console.warn('[battle] opponent AI unavailable, using the built-in agent', err);
    return undefined;
  }
}
