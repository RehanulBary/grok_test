import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import { normalizeEvent, insertNormalized, listPosts } from "./posts.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

// CORS only matters for the browser-facing GET. Lock it to your Vercel origin.
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);

// --- Webhook auth ----------------------------------------------------------
// Accept either `Authorization: Bearer <secret>` or `X-Webhook-Secret: <secret>`.
// Fails closed if WEBHOOK_SECRET is unset so posts can't be injected anonymously.
function verifySecret(req, res, next) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    return res
      .status(500)
      .json({ error: "server misconfigured: WEBHOOK_SECRET not set" });
  }

  const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const headerSecret = req.get("x-webhook-secret") || "";
  const provided = bearer || headerSecret;

  if (provided !== expected) {
    return res.status(401).json({ error: "invalid or missing webhook secret" });
  }
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// Inbound webhook. Handles one event per request (preferred), a bare array,
// or `{ posts: [...] }`. Returns quickly; work here is a single fast insert.
app.post("/webhooks/elon-posts", verifySecret, async (req, res) => {
  try {
    const body = req.body;
    let events;
    if (Array.isArray(body)) events = body;
    else if (Array.isArray(body?.posts)) events = body.posts;
    else if (body && typeof body === "object") events = [body];
    else events = null;

    if (!events || events.length === 0) {
      return res.status(400).json({ error: "empty or unrecognized body" });
    }

    // Validate/shape the payload first. Bad payloads are the bot's fault, so
    // return 400 and it won't retry an unfixable request.
    let rows;
    try {
      rows = events.map(normalizeEvent);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Persist. A failure here (DB down, etc.) is our problem, so return 5xx
    // and the bot retries on its next routine run.
    const result = await insertNormalized(rows);
    // 200 = accepted. Duplicates are counted in `skipped`, still a success.
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[webhook] error:", err);
    res.status(500).json({ error: "internal error, safe to retry" });
  }
});

// Viewer feed. Read-only, no auth.
app.get("/api/posts", async (req, res) => {
  try {
    const data = await listPosts({ limit: req.query.limit, offset: req.query.offset });
    res.json(data);
  } catch (err) {
    console.error("[list] error:", err);
    res.status(500).json({ error: "failed to load posts" });
  }
});

const port = process.env.PORT || 3001;

initDb()
  .then(() => {
    app.listen(port, () => console.log(`[server] listening on :${port}`));
  })
  .catch((err) => {
    console.error("[startup] failed to init db:", err);
    process.exit(1);
  });
