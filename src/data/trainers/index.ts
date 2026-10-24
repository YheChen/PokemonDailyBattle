import type { Trainer } from './types';
import { red } from './red';
import { blue } from './blue';
import { cynthia } from './cynthia';
import { steven } from './steven';
import { wallace } from './wallace';
import { lance } from './lance';
import { alder } from './alder';
import { iris } from './iris';
import { diantha } from './diantha';
import { leon } from './leon';
import { geeta } from './geeta';
import { nemona } from './nemona';
import { giovanni } from './giovanni';
import { n } from './n';
import { ghetsis } from './ghetsis';
import { silver } from './silver';
import { wally } from './wally';
import { oak } from './oak';
import { kukui } from './kukui';
import { volo } from './volo';
import { arven } from './arven';
import { penny } from './penny';
import { kieran } from './kieran';

export type { Trainer, TrainerPokemon, TrainerDialogue, ArenaId, Region, TrainerClass } from './types';
export { ARENAS, getArena } from './arenas';

/** Champions first (in franchise order), then other famous trainers. */
export const TRAINERS: Trainer[] = [
  red, blue, cynthia, steven, wallace, lance, alder, iris, diantha, leon, geeta, nemona,
  giovanni, n, ghetsis, silver, wally, oak, kukui, volo, arven, penny, kieran,
];

export const CHAMPIONS: Trainer[] = TRAINERS.filter((t) => t.title === 'Champion');
export const OTHER_TRAINERS: Trainer[] = TRAINERS.filter((t) => t.title !== 'Champion');

const byId = new Map(TRAINERS.map((t) => [t.id, t]));

export function getTrainer(id: string): Trainer | undefined {
  return byId.get(id);
}

/** Boss Rush order: easiest to hardest, ties broken by name. */
export function bossRushOrder(): Trainer[] {
  return [...TRAINERS].sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
}
