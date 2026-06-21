# @heejun/deskcloud

Unified, **browser-first**, **zero-runtime-dependency**, **tree-shakeable** TypeScript SDK for the
DeskCloud SaaS family. One install replaces per-Desk widget embeds and vendored fetch clients.

```bash
npm i @heejun/deskcloud
```

- **Zero runtime deps** — just a typed `fetch` wrapper. Works in browsers, Node ≥18, and edge runtimes.
- **Tree-shakeable** — `"sideEffects": false`; import only the Desk clients you use.
- **Two entries, two key types** — public (`pk_`) clients from the root, admin (`sk_`) clients from `/server`.

## Browser usage (publishable `pk_` key)

Public clients use a **publishable key** (`pk_…`). These are safe to ship in browser code:
the Desk enforces a per-tenant CORS allowlist on the request `Origin`.

```ts
import { createReviewClient } from "@heejun/deskcloud";

const review = createReviewClient({
  endpoint: "https://desk.example.com/review",
  publishableKey: "pk_live_…",
});

const { data } = await review.list({ subjectId: "product-42" });
await review.submit({ subjectId: "product-42", rating: 5, body: "Great!" });
```

## Server usage (secret `sk_` key)

Admin clients use a **secret key** (`sk_…`) and live behind the `/server` entry. Use these only in
server runtimes (Node, edge functions, API routes):

```ts
import { createReviewAdminClient } from "@heejun/deskcloud/server";

const admin = createReviewAdminClient({
  endpoint: "https://desk.example.com/review",
  secretKey: process.env.REVIEWDESK_SECRET_KEY!, // sk_live_…
});

await admin.approve({ reviewId: "rev_123" });
```

## ⚠️ SECURITY

**Never import `@heejun/deskcloud/server` (or use an `sk_` secret key) in browser / client-bundled code.**
Secret keys grant full admin access to your Desk tenant. They belong only in trusted server
environments. The browser entry (`@heejun/deskcloud`) uses publishable `pk_` keys, which are
designed to be public and are scoped by the Desk's CORS allowlist.

If a secret key is ever exposed client-side, rotate it immediately via the DeskCloud portal.

## Realtime / chat (optional peer)

Realtime and chat clients use Socket.IO. Install the optional peer only if you use them:

```bash
npm i socket.io-client
```

It is declared as an **optional** peer dependency, so it is not required for the rest of the SDK.

## Core transport

Every Desk client is built on a shared zero-dep transport you can also use directly:

```ts
import { createDeskTransport, DeskError } from "@heejun/deskcloud";

const t = createDeskTransport({ endpoint, publishableKey: "pk_…" });
try {
  const out = await t.get("/api/health");
} catch (err) {
  if (err instanceof DeskError)
    console.error(err.status, err.code, err.message);
}
```

## License

MIT
