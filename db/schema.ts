import { sql } from 'drizzle-orm';
import { bigserial, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const scores = pgTable(
  'scores',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    trackId: text('track_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    name: text('name'), // null until the player names themselves
    score: integer('score').notNull(), // higher is better; computed server-side
    lapMs: integer('lap_ms').notNull(),
    driftMs: integer('drift_ms').notNull().default(0),
    jumps: integer('jumps').notNull().default(0),
    collisions: integer('collisions').notNull().default(0),
    build: text('build').notNull(),
    runId: uuid('run_id').notNull().unique(), // run-token nonce: each token scores once
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scores_track_score_idx').on(t.trackId, t.score.desc()),
    index('scores_device_idx').on(t.deviceId),
  ],
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
