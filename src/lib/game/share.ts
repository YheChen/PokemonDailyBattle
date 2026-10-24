/**
 * Share text for daily results ("Wordle style") and a clipboard helper with a textarea fallback.
 */
import type { BattleResult } from '@/lib/battle/types';
import { outcomeLabel } from './results';

export const APP_NAME = 'Pokémon Champions';
export const ALIVE_EMOJI = '🟢';
export const FAINTED_EMOJI = '🔴';

export interface ShareTextInput {
  /** YYYY-MM-DD (UTC). */
  date: string;
  /** Trainer display name, e.g. "Champion Cynthia". */
  trainerName: string;
  result: BattleResult;
  /** Current daily streak after this result. */
  streak: number;
}

/** 🟢/🔴 grid of the player's six Pokémon (party order). */
export function resultEmojiGrid(result: BattleResult): string {
  const statuses = result.playerTeamStatus.length
    ? result.playerTeamStatus.map((p) => p.fainted)
    : Array.from({ length: 6 }, (_, i) => i >= result.playerRemaining);
  return statuses.map((fainted) => (fainted ? FAINTED_EMOJI : ALIVE_EMOJI)).join('');
}

/**
 * @example
 * "Pokémon Champions — 2026-10-21\nvs Champion Cynthia — WIN in 14 turns\n🟢🟢🔴🟢🔴🟢\nStreak: 3"
 */
export function buildShareText({ date, trainerName, result, streak }: ShareTextInput): string {
  const turns = `${result.turns} turn${result.turns === 1 ? '' : 's'}`;
  return [
    `${APP_NAME} — ${date}`,
    `vs ${trainerName} — ${outcomeLabel(result)} in ${turns}`,
    resultEmojiGrid(result),
    `Streak: ${streak}`,
  ].join('\n');
}

/**
 * Copies text to the clipboard. Uses the async Clipboard API when available and falls back to a
 * hidden textarea + `document.execCommand('copy')`. Resolves `true` on success. Browser only.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
