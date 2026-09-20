"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://grok-test.onrender.com";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export default function Home() {
  const [data, setData] = useState({ posts: [], total: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(`${API_URL}/api/posts?limit=100`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Poll so newly ingested posts appear without a manual refresh.
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="container">
      <div className="header">
        <h1>Incoming Posts</h1>
        <span className="meta">{data.total} total</span>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {error && <div className="error">Couldn&apos;t load posts: {error}</div>}
      {!loading && !error && data.posts.length === 0 && (
        <div className="empty">No posts yet. Waiting for the bot to send some.</div>
      )}

      {data.posts.map((p) => (
        <article className="card" key={p.id}>
          <div className="card-top">
            <span className="author">
              {p.author_name || p.author_username || "unknown"}
              {p.author_username && (
                <span className="handle"> @{p.author_username}</span>
              )}
            </span>
            <span>{timeAgo(p.post_created_at || p.received_at)}</span>
          </div>
          <div className="content">{p.text || "(no text)"}</div>
          {p.url && (
            <div style={{ marginTop: 8 }}>
              <a href={p.url} target="_blank" rel="noreferrer">
                source ↗
              </a>
            </div>
          )}
        </article>
      ))}
    </main>
  );
}
