import { pool } from "./db.js";

// Map one webhook event to our columns. Matches the documented shape:
//   { event, source, checked_at, author:{username,name}, post:{id,text,url,created_at} }
// with light fallbacks so a bare/flat post still works.
export function normalizeEvent(event) {
  if (typeof event !== "object" || event === null) {
    throw new Error("each event must be a JSON object");
  }

  const author = event.author ?? {};
  const post = event.post ?? event;

  const post_id = post.id ?? post.post_id ?? null;
  if (post_id == null) {
    throw new Error("missing post.id (required for dedupe)");
  }

  return {
    post_id: String(post_id),
    author_username: author.username ?? null,
    author_name: author.name ?? null,
    text: post.text ?? null,
    url: post.url ?? null,
    post_created_at: post.created_at ? new Date(post.created_at) : null,
    event: event.event ?? null,
    source: event.source ?? null,
    checked_at: event.checked_at ? new Date(event.checked_at) : null,
    raw: event,
  };
}

// Insert already-normalized rows. Duplicate post_id is skipped (idempotent),
// so the bot can safely re-send the same post.
export async function insertNormalized(rows) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;
    let skipped = 0;

    for (const p of rows) {
      const result = await client.query(
        `INSERT INTO posts
           (post_id, author_username, author_name, text, url, post_created_at, event, source, checked_at, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (post_id) DO NOTHING
         RETURNING id`,
        [
          p.post_id,
          p.author_username,
          p.author_name,
          p.text,
          p.url,
          p.post_created_at,
          p.event,
          p.source,
          p.checked_at,
          p.raw,
        ]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    }

    await client.query("COMMIT");
    return { inserted, skipped };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listPosts({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { rows } = await pool.query(
    `SELECT id, post_id, author_username, author_name, text, url,
            post_created_at, event, source, checked_at, received_at
     FROM posts
     ORDER BY received_at DESC
     LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS total FROM posts`
  );

  return { posts: rows, total: countRows[0].total, limit: safeLimit, offset: safeOffset };
}
