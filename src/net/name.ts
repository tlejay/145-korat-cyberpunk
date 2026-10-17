// Player name rules shared by client (instant feedback) and server (authority).
import type { ErrorCode } from './codes.js';
import { BAD_TOKENS, BAD_WORDS } from './bad-words.js';

export const NAME_MIN = 2;
export const NAME_MAX = 16;

// Thai block, ASCII letters/digits, single inner spaces.
const ALLOWED = /^[฀-๿A-Za-z0-9 ]+$/u;

const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });

export function nameLength(name: string): number {
  let n = 0;
  for (const _ of segmenter.segment(name)) n++;
  return n;
}

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

// Strip spacing, digits used as letters and Thai tone/vowel marks so that
// "f u c k", "fuuck" and tone-mark variants of Thai words still match.
function skeleton(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
    .replace(/[ัิ-ฺ็-๎]/gu, '')
    .replace(/[^฀-๿a-z]/gu, '')
    .replace(/(.)\1+/gu, '$1');
}

const BAD_SKELETONS = BAD_WORDS.map(skeleton).filter((w) => w.length >= 2);
const BAD_TOKEN_SET = new Set(BAD_TOKENS.map(skeleton));

export function isProfane(name: string): boolean {
  const s = skeleton(name);
  if (BAD_SKELETONS.some((w) => s.includes(w))) return true;
  // Whole-word check on raw tokens, plus the whole name with spaces removed.
  const tokens = [...name.split(' '), name].map(skeleton);
  return tokens.some((t) => BAD_TOKEN_SET.has(t));
}

export function validateName(raw: unknown): { ok: true; name: string } | { ok: false; code: ErrorCode } {
  if (typeof raw !== 'string') return { ok: false, code: 'BAD_REQUEST' };
  const name = normalizeName(raw);
  const len = nameLength(name);
  if (len < NAME_MIN) return { ok: false, code: 'NAME_TOO_SHORT' };
  if (len > NAME_MAX) return { ok: false, code: 'NAME_TOO_LONG' };
  if (!ALLOWED.test(name)) return { ok: false, code: 'NAME_BAD_CHARS' };
  if (isProfane(name)) return { ok: false, code: 'NAME_PROFANE' };
  return { ok: true, name };
}
