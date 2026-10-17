import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// `vercel env pull` writes .env.local
config({ path: '.env.local' });

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
});
