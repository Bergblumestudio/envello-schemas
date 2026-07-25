# @envello/schemas

Shared Zod request/response schemas for the [Envello](https://envello.dev) transactional email API. Used internally by `apps/api` and `apps/dashboard` in the [Envello monorepo](https://github.com/deepak-mishra/envello), and re-exported by the `envello` Node SDK so callers don't need a separate dependency just to reference request/response types.

Not typically installed directly — see the [`envello`](https://www.npmjs.com/package/envello) SDK instead, unless you specifically need the Zod schemas (e.g. to validate a webhook payload without pulling in the full SDK).

> This repo mirrors `packages/schemas` in the [Envello monorepo](https://github.com/deepak-mishra/envello), which remains the source of truth (it's also a direct dependency of `apps/api`/`apps/dashboard` there). Published to npm from the monorepo; this mirror exists for public visibility and issue tracking.
