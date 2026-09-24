# DSR2P-BE

Backend API for the restaurant review portal (Ruchi / Dine Score) — COMP70066 Stage 4 implementation.

## Stack
- Node.js + Express + TypeScript
- PostgreSQL 14+ via Prisma ORM
- JWT auth (`jsonwebtoken`), password hashing via `bcryptjs`
- Validation via `zod`
- Tests via `vitest` + `supertest`

## Local setup
1. Copy `.env.example` to `.env` and set `DATABASE_URL` to a local PostgreSQL 14+ instance and a strong `JWT_SECRET`.
2. Install dependencies:
   ```
   npm install
   ```
3. Apply the schema and generate the Prisma client:
   ```
   npm run prisma:migrate
   ```
4. Seed sample data (Admin/Customer accounts, sample restaurant/menu/review):
   ```
   npm run prisma:seed
   ```
5. Start the dev server (reloads on change):
   ```
   npm run dev
   ```
6. Confirm it's up: `GET http://localhost:3000/health` → `{ "status": "ok" }`
7. API docs (Swagger UI): http://localhost:3000/docs — raw OpenAPI spec at `/docs/openapi.json` (source: `src/docs/openapi.ts`)

## Scripts
- `npm run dev` — start with hot reload
- `npm run build` / `npm start` — compile then run production build
- `npm test` — run the vitest suite
- `npm run prisma:migrate` — create/apply a dev migration
- `npm run prisma:deploy` — apply migrations in CI/production
- `npm run prisma:seed` — reseed sample data

## Auth model
Three request states, distinguished by `src/middleware/auth.ts`:
- **Anonymous (Guest)** — no/invalid Bearer token; `req.user` is undefined.
- **Customer** — valid token with `role: "Customer"`; gated by `requireAuth`.
- **Admin** — valid token with `role: "Admin"`; gated by `requireAdmin`.

## Error shape
Every error response is `{ "error": { "code", "message", "details?" } }`, produced centrally in `src/middleware/errorHandler.ts` (see [DSR2P]-2-BE2, [DSR2P]-38-BE1).

## Project structure
```
prisma/
  schema.prisma      # DB schema ([DSR2P]-1)
  seed.ts            # sample data ([DSR2P]-1-BE5)
src/
  app.ts             # Express app wiring
  server.ts           # process entrypoint
  lib/                # prisma client, JWT helpers, ApiError, asyncHandler
  middleware/          # auth, error handling
  modules/
    auth/             # register/login ([DSR2P]-4, [DSR2P]-5)
    users/            # profile update ([DSR2P]-6)
    health/           # GET /health
tests/                # vitest + supertest specs
```

See [BACKEND_PLAN.md](../BACKEND_PLAN.md) for the full phased backend backlog.
