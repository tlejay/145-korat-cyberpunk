import { sql } from 'drizzle-orm';
import { bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const scores = pgTable(
  'scores',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    trackId: text('track_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    name: text('name'), // null until the player names themselves
    score: integer('score').notNull(), // higher is better; computed server-side (src/net/score.ts)
    scoreTime: integer('score_time').notNull(),
    scoreStyle: integer('score_style').notNull(),
    totalMs: integer('total_ms').notNull(), // whole race (all laps)
    lapMs: integer('lap_ms').notNull(), // best lap
    build: text('build').notNull(),
    result: jsonb('result').notNull(), // raw RunResult as sent (audit / future replay checks)
    runId: uuid('run_id').notNull().unique(), // run-token nonce: each token scores once
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scores_track_score_idx').on(t.trackId, t.score.desc()),
    index('scores_device_idx').on(t.deviceId),
  ],
);

// Best-run ghost per device per track (GAMEPLAY §5.3). Replaced only by a higher score.
export const ghosts = pgTable(
  'ghosts',
  {
    trackId: text('track_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    runId: uuid('run_id').notNull(),
    score: integer('score').notNull(),
    lapMs: integer('lap_ms').notNull(),
    data: text('data').notNull(), // base64 deflate-raw of ghost-format v1
    build: text('build').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.trackId, t.deviceId] }), index('ghosts_track_score_idx').on(t.trackId, t.score.desc())],
);

// Sliding-window rate limit log (key = "<action>:<device|ip>").
export const rateEvents = pgTable(
  'rate_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    key: text('key').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('rate_events_key_at_idx').on(t.key, t.at)],
);
