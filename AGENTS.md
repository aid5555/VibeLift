# AGENTS.md — VibeLift AI Rulebook

This file is the source of truth for **every AI coding agent** (and human contributor)
that modifies this repository. Read it fully before touching any file. When your
suggested change conflicts with a rule below, **the rule wins** — do not silently
"improve" on it.

VibeLift is an AI-powered fitness coaching web application built with
Next.js 14+ (App Router), TypeScript, Tailwind CSS, SQLite (Prisma), and Docker.

---

## 1. Architecture & Deployment

- **One container, everything inside.** The entire application — Next.js frontend,
  API route handlers, background logic, and the SQLite database — MUST build and run
  inside a **single, self-contained Docker container**. There are no external
  database services, no sidecars, no shared volumes to another DB engine.
- The canonical database URL is `file:/data/vibelift.db`. The container mounts a
  persistent host folder at `/data` for both the SQLite file and uploaded photos.
  Never introduce a `postgres`, `mysql`, or network database dependency.
- Any new feature must survive this single-container lifecycle:
  1. `docker compose up --build` produces one service (`vibelift`) on port `3000`.
  2. Prisma migrations are applied **at container startup** (see `docker-entrypoint.sh`).
  3. The SQLite file and photo blobs persist under the mounted `/data` volume.
- If a feature cannot work in that lifecycle, it is out of scope by design.

## 2. Modular Separation (strict layering)

Keep the codebase layered. Dependencies may only point **inward** (outer layers
depend on inner layers, never the reverse).

| Layer        | Directory            | Allowed to import                              | Must NOT import |
| ------------ | -------------------- | ---------------------------------------------- | --------------- |
| UI           | `src/app`, `src/components` | `src/lib`, `src/services` (via composition), `src/types` | Prisma client directly, raw `fetch` to external APIs |
| API routes   | `src/app/api`        | `src/services`, `src/lib`, `src/env`, `src/types` | UI components |
| Services     | `src/services`       | `src/lib`, `src/types`                         | UI components, Next.js `next/server` helpers |
| Lib/Core     | `src/lib`, `src/env` | `src/types`, third-party SDKs                  | UI components, services |
| Types        | `src/types`          | (nothing else in `src`)                        | anything |

- **Database access** lives only in `src/lib/db.ts` (the Prisma singleton) and
  repository adapters inside services. UI components never touch the DB.
- **External API clients** (Lyfta, OpenAI/OpenCode) live only in `src/lib/*.ts`
  (base clients) and `src/services/*Service.ts` (domain logic). UI never calls
  `fetch` to third parties directly.
- Compose dependencies explicitly. Prefer **dependency injection** (constructor /
  factory arguments) over global singletons so every service is testable in
  isolation. Example factory signature:
  `createLyftaService(config: LyftaConfig, fetchImpl?: FetchLike): LyftaService`.

## 3. Type Safety (TypeScript)

- `strict: true` and `noUncheckedIndexedAccess` are enforced in `tsconfig.json`.
  Do **not** weaken or add `// @ts-ignore`, `// @ts-expect-error`, or `any`.
- **No `any`.** If a value is unknown, keep it `unknown` and narrow it with Zod or
  type guards before use.
- **Every exported function/method must declare an explicit return type.**
  This includes React components (`ReactElement`, `ReactNode`, or `Promise<...>`).
- **Zod for all boundaries.** Validate with Zod:
  - All environment variables (`src/env.ts`).
  - All API route input bodies / query params (`src/app/api/**`).
  - All external API responses before trusting them (`src/services/*Service.ts`).
  - All AI tool call arguments (`src/services/aiService.ts`).
- Never parse JSON with bare `JSON.parse` at a trust boundary without schema
  validation; route it through `src/lib/validation.ts` `parseOrThrow` or an
  equivalent `safeParse` + typed error.
- Prefer `interface` for object shapes and `type` for unions/mapped/utility types.
  Keep shared interfaces/schemas in `src/types`; do not scatter inline types that
  cross layers.

## 4. Testing (TDD is mandatory)

- Follow **Test-Driven Development**: write the failing test first, then implement
  until it passes, then refactor. Do not add features without tests.
- **Every** API route, service-layer function (Lyfta client methods, database
  queries, AI tool builder/executor), and complex UI component must have a
  corresponding `*.test.ts` / `*.test.tsx` file.
- Tests live beside the code under `__tests__/` or as `*.test.ts(x)` siblings.
  Use Vitest + Testing Library. Unit tests run in `jsdom`; pure logic may run in
  `node`. Mock external I/O (fetch, filesystem, Prisma) — never hit real services.
- Keep the suite fast and deterministic: no real network, no real database in
  unit tests. Integration tests that need SQLite use an in-memory/`file:` temp DB.
- Run `npm run test` before considering any change complete. `npm run type-check`
  and `npm run lint` must also pass. `npm run build` must pass before merging.

## 5. Error Handling

- Use the **typed error classes** in `src/lib/errors.ts` (`AppError` and its
  subclasses: `EnvValidationError`, `ValidationError`, `NotFoundError`,
  `ExternalApiError`, `DatabaseError`). Do not `throw new Error('...')` for domain
  failures — subclass and carry `code` + `statusCode`.
- **Catch, wrap, and rethrow with context.** External failures become
  `ExternalApiError` with the upstream status attached. Never swallow errors
  silently; if you intentionally ignore one, comment why.
- **Structured API responses.** Use `src/lib/response.ts` (`ok`, `fail`,
  `handleError`) so every route returns the same envelope:
  `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.
- **Clean logging.** Use a single logging helper (structured, leveled). Do not
  `console.log` secrets, API keys, or full request bodies. Log errors with their
  `code`, not just `message`.
- Defensive programming: assume external data is hostile, validate before use,
  handle `null`/`undefined` explicitly, and guard array/object access.

## 6. Code Formatting & Style

- **Functional & declarative** over imperative/class-heavy where reasonable.
  Prefer pure functions, immutable updates, and small composable helpers. Side
  effects are isolated at the boundary (services, route handlers).
- **Clean, descriptive variable names.** No single-letter names except tight loops
  (`i`, `j`) and well-known functional params (`f`, `g`). Booleans start with
  `is`/`has`/`should`.
- **DRY.** Extract repeated logic into `src/lib` helpers. Duplicate a concept
  before you duplicate code — but do not prematurely abstract.
- **Component structure (Atomic Design):**
  - `src/components/atoms` — single-purpose primitives (Button, Input, Badge).
  - `src/components/molecules` — small compositions of atoms (Card, StatCard).
  - `src/components/organisms` — full sections composing molecules (Dashboard).
  Keep presentational components free of data-fetching; pass data via props.
- **Naming conventions:**
  - Files: `kebab-case.ts` for utilities/services; `PascalCase.tsx` for components.
  - Routes: `src/app/api/<resource>/route.ts` with `GET`/`POST`/`PUT`/`DELETE`
    exported as named handlers.
  - Schemas/types: `<Domain>Schema` for Zod, inferred `<Domain>` for the type.
- Keep files focused; extract when a file grows beyond a single responsibility.

## 7. Environment & Configuration

- All environment access goes through `src/env.ts` via `getEnv()`. Never read
  `process.env.X` directly in feature code.
- Adding an env var requires: a Zod entry in `envSchema`, a line in `.env.example`,
  and a test case in `src/env.test.ts`. Required keys throw `EnvValidationError`
  at startup when missing or malformed.
- Secrets are never committed. `.env*` files are gitignored; `.env.example` holds
  placeholders only.

## 8. Git & Workflow

- One logical change per commit; concise messages in the repo's existing style.
- Do **not** commit generated artifacts (`.next`, `node_modules`, `coverage`,
  local `*.db` files).
- Before a PR: `npm run lint`, `npm run type-check`, `npm run test`, and
  `npm run build` must all pass.

## 9. Single-Container Database & Prisma Rules

- `prisma/schema.prisma` uses the `sqlite` provider with
  `url = env("DATABASE_URL")`.
- Schema changes require a new migration (`npm run prisma:migrate -- --name <x>`).
  Commit the generated `prisma/migrations/**` SQL.
- At runtime, `prisma migrate deploy` runs from `docker-entrypoint.sh` before the
  server starts. Never assume a fresh DB already has tables.
- Access Prisma through the singleton in `src/lib/db.ts`. Services receive a
  narrow repository interface (not the raw client) to stay testable.

## 10. Verification Checklist (run before finishing any task)

```
npm run type-check
npm run lint
npm run test
npm run build
```

If any command fails, the task is not done. When adding a Docker/SQLite change,
also verify `docker compose up --build` starts cleanly and migrations apply.
