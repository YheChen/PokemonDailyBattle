/**
 * Resume identity: a saved battle may only be resumed by the setup it was saved from. Pure, no storage.
 */
import type { BattleSetup } from '@/lib/battle/types';
import type { SavedBattle } from './types';

/**
 * True when `saved` is the same battle `setup` asks to play: same save key, same battle seed and the
 * same opponent (trainer id and name). Fresh Free/Custom/Boss Rush setups draw a new random seed, so an
 * older save under the same key never matches them; a Daily setup (deterministic seed) and a setup handed
 * back from a Resume button always do.
 */
export function matchesSavedBattle(saved: SavedBattle | null | undefined, setup: BattleSetup): saved is SavedBattle {
  if (!saved?.setup || !saved.serialized) return false;
  if (!setup.saveKey || saved.setup.saveKey !== setup.saveKey) return false;
  if ((saved.setup.config.seed ?? null) !== (setup.config.seed ?? null)) return false;
  if ((saved.setup.trainerId ?? null) !== (setup.trainerId ?? null)) return false;
  return saved.setup.config.opponent.name === setup.config.opponent.name;
}
