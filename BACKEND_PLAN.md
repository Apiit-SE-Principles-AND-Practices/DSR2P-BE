# Backend Implementation Plan — DSR2P-BE

Derived from `DSR2P-Product-Backlog.docx`. Scope: backend (`-BE#`) tasks only. Frontend tasks are out of scope here but noted where a backend task is a hard dependency for one.

## Tech decisions to confirm before Phase 0 - done
- Stack: Node.js/Express + PostgreSQL 14+ — **implemented**
- Auth: JWT — **implemented**
- Migration tool: Prisma — **implemented**
- Test runner: Vitest (+ Supertest) — **implemented**

Scaffold is live: `src/app.ts`, `src/server.ts`, `prisma/schema.prisma`, auth/users/health modules,
central error handler, `requireAuth`/`requireAdmin` middleware, seed script. See root `README.md`
for local setup.

## Phase 0 — Foundations (Epic 1 + Epic 2, blocking everything else)
1. **[DSR2P-1] Schema & migrations** Done
   - Version-control `schema.sql`, wire into migration tool (1-BE1)
   - Migrations: `reviews.photo_url`/`review_images` (1-BE2), `review_likes` with `UNIQUE(review_id,user_id)` (1-BE3), `rejection_reason` on reviews/comments (1-BE4)
   - Seed script: sample restaurants/menu items + 1 Admin/Customer (1-BE5)
2. **[DSR2P-2] API scaffold** done
   - Project init, data-access layer stubs for all tables (2-BE1)
   - Request logging + centralized error middleware, consistent JSON error shape (2-BE2)
   - Auth middleware skeleton: anonymous/Customer/Admin (2-BE3)
   - README with local setup (2-BE4)
   - `GET /health`
3. **[DSR2P-4] Registration** — `POST /auth/register` (4-BE1), 409 duplicate / 400 field errors (4-BE2) done
4. **[DSR2P-5] Login** — `POST /auth/login` (5-BE1) done
5. **[DSR2P-6] Profile update** — `PATCH /users/me` (6-BE1) done 
6. **[DSR2P-7] Auth/Admin gating middleware** — `requireAuth()` (7-BE1), `requireAdmin()` (7-BE2) done

## Phase 1 CRUD Restuarant done

## Phase 1.1 — Browse & Search (Epic 3) + Derived Calculations (Epic 6)
7. **[DSR2P-23/24/25]** `calculateAverageRating()` (restaurant + item scoped), `calculatePriceBand()` — pure query-time, no stored columns
8. **[DSR2P-8]** `GET /categories`
9. **[DSR2P-9]** `GET /restaurants?city=` (requires city param, uses `idx_restaurants_city`)
10. **[DSR2P-10]** `GET /search?q=&city=` (10-BE1), perf/index tuning + load test for <2s (10-BE2)
11. **[DSR2P-11]** `GET /restaurants/search` with category/diet/spice/price filters
12. **[DSR2P-12]** sort param (rating|price)
13. **[DSR2P-13]** search response includes computed `averageRating`/`priceBand`

## Phase 2 — Restaurant Detail & Menu (Epic 4)
14. **[DSR2P-14]** `GET /restaurants/:id` with per-dimension avg from Approved reviews
15. **[DSR2P-15]** `GET /restaurants/:id/menu`
16. **[DSR2P-16]** `GET /restaurants/:id/reviews?status=Approved&sort=` with nested comments/likes/response

## Phase 3 — Reviews, Likes, Comments, Responses (Epic 5)
17. **[DSR2P-17]** `POST /reviews` submit(), CHECK 1–5 integer (boundary 0/6), structured errors
18. **[DSR2P-18]** `GET /users/me/reviews`, `/users/me/comments` (own content, all statuses + rejection_reason)
19. **[DSR2P-19]** `POST /reviews/:id/comments` (Pending)
20. **[DSR2P-20]** `POST /reviews/:id/response` (Admin-only, UNIQUE conflict → 409)
21. **[DSR2P-21]** photo upload on review submit/edit + server-side resize/compression pipeline
22. **[DSR2P-22]** `POST/DELETE /reviews/:id/like` (requireAuth, UNIQUE constraint)

## Phase 4 — Multi-language (Epic 7, backend slice)
23. **[DSR2P-27]** verify UTF8 round-trip for all free-text fields

## Phase 5 — Admin Management (Epic 8)
24. **[DSR2P-29]** `POST/PUT/DELETE /admin/restaurants` (+ initial menu items on create), CASCADE delete - done
25. **[DSR2P-30]** `POST/PUT/DELETE /admin/restaurants/:id/menu-items` (price >=0 check)
26. **[DSR2P-31]** image_url/content fields in update endpoints

## Phase 6 — Moderation & Dashboard (Epic 9)
27. **[DSR2P-32]** `GET /admin/moderation/queue`
28. **[DSR2P-33]** `PATCH /admin/reviews/:id/approve|reject(reason)` + audit that all public reads filter `status='Approved'`
29. **[DSR2P-34]** `PATCH /admin/comments/:id/approve|reject(reason)`
30. **[DSR2P-35]** `GET /admin/dashboard/stats`

## Phase 7 — Cross-cutting NFR work (Epic 10, backend slice)
31. **[DSR2P-36]** mirror all CHECK constraints as API validation (ratings 1–5, email/password rules)
32. **[DSR2P-37]** query optimization + perf test (<2s p95)
33. **[DSR2P-38]** structured error responses on all mutating endpoints (no unhandled 500s)
34. **[DSR2P-42]** OpenAPI spec / Postman collection for all endpoints
35. **[DSR2P-43]** test runner setup; unit tests (rating/price-band calc, moderation transitions); integration tests (auth, review submit, like, moderation) traceable to BB01–BB20

## Phase 8 — Legal/Ethical/Societal (Epic 11, backend slice)
36. **[DSR2P-44]** data-export endpoint + account-deletion endpoint (relies on CASCADE)
37. **[DSR2P-46]** `POST /reviews/:id/report`, `/comments/:id/report` (requireAuth, surfaced to moderation query)

## Dependency notes
- Phase 0 blocks everything.
- Epic 6 (ratings/price-band) must land before Phase 1/2/3 endpoints that expose computed fields.
- Moderation (Phase 6) depends on Phase 3 (reviews/comments to moderate) existing first.
- Photo upload (21) needs schema extension from Phase 0 (1-BE2).
- Likes (22) needs `review_likes` table from Phase 0 (1-BE3).
- Rejection reasons (18, 33, 34, 46) need `rejection_reason` column from Phase 0 (1-BE4).

## Suggested sprint grouping
- **Sprint 1**: Phase 0
- **Sprint 2**: Phase 1 + Phase 2
- **Sprint 3**: Phase 3 + Phase 4
- **Sprint 4**: Phase 5 + Phase 6
- **Sprint 5**: Phase 7 + Phase 8 (pull individual NFR/legal tasks into whichever sprint hardens the related feature, per backlog §7)
