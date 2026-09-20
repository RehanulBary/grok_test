import pg from "pg";

const { Pool } = pg;

// Render provides DATABASE_URL. SSL is required for Render-hosted Postgres,
// but we relax rejectUnauthorized so it works without shipping the CA cert.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "[db] DATABASE_URL is not set. Set it to your Render Postgres connection string."
  );
}

const isLocalhost =
  connectionString && (connectionString.includes("localhost") || connectionString.includes("127.0.0.1"));

export const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSL === "disable" || isLocalhost
      ? false
      : { rejectUnauthorized: false },
});

// Schema matches the webhook contract: a row per X post, deduped on post_id.
// Known fields are broken out for display/querying; `raw` keeps the full
// original webhook body so nothing is lost if the payload grows.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id               BIGSERIAL PRIMARY KEY,
      post_id          TEXT UNIQUE NOT NULL,
      author_username  TEXT,
      author_name      TEXT,
      text             TEXT,
      url              TEXT,
      post_created_at  TIMESTAMPTZ,
      event            TEXT,
      source           TEXT,
      checked_at       TIMESTAMPTZ,
      raw              JSONB NOT NULL DEFAULT '{}'::jsonb,
      received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS posts_received_at_idx ON posts (received_at DESC);`
  );
  console.log("[db] schema ready");
}
