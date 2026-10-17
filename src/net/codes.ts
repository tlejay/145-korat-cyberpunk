// Error codes returned by /api/*. The game maps them to Thai text in messages.ts —
// the API never returns human-readable text.
export const ERROR_CODES = [
  'BAD_REQUEST',
  'BAD_TRACK',
  'BAD_DEVICE',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_MISMATCH',
  'RUN_USED',
  'QA_RUN',
  // validateRun() checks — docs/dev/GAMEPLAY.md §6.2
  'BAD_LAPS',
  'BAD_TOTAL',
  'TOO_FAST',
  'BAD_CLOCK',
  'BAD_SPLITS',
  'BAD_STYLE',
  'BAD_TANK',
  'OLD_BUILD',
  'BAD_GHOST',
  'RATE_LIMITED',
  'NAME_TOO_SHORT',
  'NAME_TOO_LONG',
  'NAME_BAD_CHARS',
  'NAME_PROFANE',
  'NO_SCORE',
  'SERVER_ERROR',
  'NETWORK',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  ok: false;
  code: ErrorCode;
}
