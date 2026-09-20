# Posts Webhook + Viewer

A small two-part app:

- **backend/** — Node + Express webhook on **Render**, backed by **Render Postgres**. The grok bot POSTs new X posts to it; a read endpoint feeds the viewer.
- **frontend/** — Next.js viewer on **Vercel** that lists incoming posts and polls for new ones.

## Webhook contract

`POST /webhooks/elon-posts`

**Auth** (either header):

- `Authorization: Bearer <secret>`
- `X-Webhook-Secret: <secret>`

**Body** (one event per request preferred; a bare array or `{ "posts": [...] }` also works):

```json
{
  "event": "x.post.new",
  "source": "grok-bot",
  "checked_at": "2026-09-20T13:30:00+06:00",
  "author": { "username": "elonmusk", "name": "Elon Musk" },
  "post": {
    "id": "1234567890",
    "text": "post text here",
    "url": "https://x.com/elonmusk/status/1234567890",
    "created_at": "2026-09-20T13:28:00+06:00"
  }
}
```

**Responses:**

- `200` — accepted (duplicates are counted as `skipped`, still a success)
- `401` — bad/missing secret
- `400` — unparseable body or missing `post.id`
- `5xx` — server/DB error; safe for the bot to retry next run

Dedupe is on `post.id` (`ON CONFLICT DO NOTHING`), so re-sending the same post is a no-op. The full original body is kept in a `raw` JSONB column.

### Test it

```bash
curl -i -X POST "$API_URL/webhooks/elon-posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -d '{
    "event":"x.post.new","source":"grok-bot","checked_at":"2026-09-20T13:30:00+06:00",
    "author":{"username":"elonmusk","name":"Elon Musk"},
    "post":{"id":"1234567890","text":"hello","url":"https://x.com/elonmusk/status/1234567890","created_at":"2026-09-20T13:28:00+06:00"}
  }'
```

## Other endpoints

| Method | Path                    | Auth      | Purpose            |
| ------ | ----------------------- | --------- | ------------------ |
| GET    | `/health`               | none      | Health check       |
| GET    | `/api/posts`            | none      | Feed for the viewer |

## Run locally

Backend:

```bash
cd backend
cp .env.example .env      # set DATABASE_URL + WEBHOOK_SECRET
npm install
npm run dev               # http://localhost:3001
```

Frontend:

```bash
cd frontend
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > .env.local
npm install
npm run dev               # http://localhost:3000
```

## Deploy

**Backend → Render:** `backend/render.yaml` provisions a web service + free
Postgres and auto-generates `WEBHOOK_SECRET`. After deploy, set
`FRONTEND_ORIGIN` to your Vercel URL, then copy the generated `WEBHOOK_SECRET`
and give it to the grok bot along with the webhook URL.

**Frontend → Vercel:** import the repo, set root directory to `frontend`, and
set `NEXT_PUBLIC_API_URL` to your Render backend URL.
