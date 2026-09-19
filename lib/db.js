// Postgres connection for the saved listing history.
// Vercel's Neon integration sets DATABASE_URL for you when you add a
// Postgres database under the project's Storage tab.

import { neon } from "@neondatabase/serverless";

let client;
let schemaReady;

function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Server is missing DATABASE_URL. Add a Postgres database under the project's Storage tab in Vercel."
    );
  }
  if (!client) {
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Creates the table on first use so there's no separate migration step to
// run. Cached per warm instance; cleared on failure so the next call retries.
export async function getSql() {
  const sql = getClient();

  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS listing_history (
        id           SERIAL PRIMARY KEY,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        listing_url  TEXT        NOT NULL DEFAULT '',
        provider     TEXT        NOT NULL DEFAULT '',
        prompt       TEXT        NOT NULL,
        photos       JSONB       NOT NULL DEFAULT '[]'::jsonb,
        selected     JSONB       NOT NULL DEFAULT '[]'::jsonb,
        settings     JSONB       NOT NULL DEFAULT '{}'::jsonb
      )
    `.catch((err) => {
      schemaReady = null;
      throw err;
    });
  }

  await schemaReady;
  return sql;
}
