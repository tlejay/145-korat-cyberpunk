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
  'RUN_TOO_FAST',
  'RUN_IMPLAUSIBLE',
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
