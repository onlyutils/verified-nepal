# Requirement: media variants (small + compressed) in OnlyUtils media service

## Why

Help requests ("Needs") can now attach optional supporting photos/videos so
moderators can verify a request visually instead of always calling the
registrant. Moderators view these in the queue UI, often on slow connections
and in bulk (many pending items open at once), so loading full-size originals
for every item is wasteful and slow — especially for video.

## Current behavior

`server/src/models/media.js` (`requestPresign`) calls
`POST /v1/clients/{clientId}/media/files` on the OnlyUtils media service and
gets back exactly one URL pair: `uploadUrl` (to PUT the file to) and
`publicUrl` (to read it back from). There is no way to ask for anything else.

Verified Nepal's client code (`src/pages/get-help/index.tsx`,
`src/desk/queue.tsx`) currently uploads and displays only that one original
file. This is fine for photos in the near term but is not a good long-term
fit, especially for video.

## What's needed

When requesting a presigned upload, the caller should be able to ask the
media service to also produce:

1. **`small`** — a fast-loading preview:
   - Photo: resized so the longest edge is ~480px, re-encoded as JPEG/WebP.
   - Video: a single extracted thumbnail frame (same size target as above).
2. **`compressed`** — a reasonably-sized playable/viewable version:
   - Photo: re-encoded at a fixed max resolution (e.g. 1600px longest edge)
     and quality, capping file size without visible quality loss for review
     purposes.
   - Video: re-encoded at a capped resolution/bitrate (e.g. 720p, ~2 Mbps)
     so it streams smoothly in a browser `<video>` tag without downloading
     the full original.
3. The **original** stays available as today, unchanged.

## Shape

Photo variants can likely be generated synchronously (fast). Video variants
require transcoding and are necessarily asynchronous. Proposed response
shape for the presign call:

```jsonc
// POST /v1/clients/{clientId}/media/files
// request: { filename, content_type, visibility, "variants": ["small", "compressed"] }
// response:
{
  "file_id": "...",
  "upload": { "url": "...", "headers": { ... } },
  "public_url": "...",          // original, available once the PUT completes
  "variants": {
    "small": { "status": "ready" | "processing" | "unavailable", "url": "..." },
    "compressed": { "status": "ready" | "processing" | "unavailable", "url": "..." }
  }
}
```

Since video variants won't be ready at presign time, the caller needs a way
to find out when they're done — either:

- **Poll** a `GET /v1/clients/{clientId}/media/files/{file_id}` endpoint that
  returns the same `variants` block with updated `status`/`url`, or
- **Webhook**: the client registers a callback URL once and the service
  POSTs `{ file_id, variants }` to it when transcoding finishes.

Polling is simpler to integrate with the current serverless setup and is the
preferred option unless a webhook is already planned for other reasons.

## Non-goals for this requirement

- No requirement to keep the original if variants exist — the original stays
  authoritative and moderators can always fall back to it.
- No requirement to support arbitrary variant sizes — the two named variants
  above (`small`, `compressed`) cover the known use case.

## Once this ships

`requestPresign` in `server/src/models/media.js` gets a `variants` option
passed through to the OnlyUtils call, and the response's `variants` block
gets forwarded to the client. `NeedMediaItem` (see `src/lib/api.ts`) already
has optional `smallUrl`/`compressedUrl` fields reserved for this — no schema
migration needed, they just start getting populated.
