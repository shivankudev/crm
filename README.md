# Gatti E-Rickshaw CRM

Internal CRM replacing the Google Sheets telecalling workflow. See
[`01-architecture.md`](./01-architecture.md) for the full system design (ERD,
role/permission matrix, page map, API design) and
[`prisma/schema.prisma`](./prisma/schema.prisma) for the data model.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, PostgreSQL via
Prisma, Redis + BullMQ for background jobs, Docker Compose for deployment.

**Status:** All nine build phases are complete:

1. **Foundation** — auth, roles & permissions (data-driven, editable from Settings), user management.
2. **Leads & Follow-ups** — lead CRUD + lifecycle, dedupe, calls, notes, timeline, follow-up
   scheduling/overdue-detection background jobs.
3. **Telecalling & Pipeline** — a fast call-queue workspace and a drag-and-drop pipeline kanban.
4. **Dealers** — onboarding lifecycle with auto dealer-code issuance, documents (local-disk
   storage), shared notes/follow-ups.
5. **Factory Visits** — scheduling + outcome tracking, a Visits tab on the lead profile.
6. **Products & Orders** — a product catalog and dealer orders with GST/discount line totals.
7. **Reports** — pipeline funnel, lead source, geography, and telecaller-performance views,
   RBAC-scoped the same way the underlying lists are.
8. **Import/Export** — CSV lead import with a preview/validate/commit flow, CSV export for
   leads and dealers.
9. **Settings & Audit Logs** — admin UI for statuses/sources/lost-reasons/follow-up rules/the
   telecaller status allowlist, plus an audit trail.

Not built: a dedicated Tasks/Calendar UI (the `Task` model exists but has no page yet),
in-app notifications, the S3/MinIO storage driver (local disk only), and full India
district/city data (states only).

## Local development (without Docker)

Requires Postgres and Redis running locally.

```bash
cp .env.example .env   # edit DATABASE_URL / REDIS_URL if needed
npm install
npm run db:migrate     # applies prisma/migrations
npm run db:seed        # roles, permissions, sample lookups, one Super Admin
npm run dev             # http://localhost:3000
```

In a second terminal, run the background job worker:

```bash
npm run worker
```

The seed script prints the Super Admin's login email/password to the
console — set `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in
`.env` before seeding to control what they are. **Change the password after
first login.**

## Running with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

This starts `postgres`, `redis`, `web`, and `worker`. Two one-off containers
run first and exit: `migrate` (applies pending Prisma migrations) then
`seed` (roles, permissions, sample lookups, first Super Admin — idempotent,
so it's safe on every `up`). Watch its logs once for the Super Admin
credentials: `docker compose logs seed`.

Object storage (dealer docs, factory-visit photos) is optional — enable a
local MinIO with:

```bash
docker compose --profile storage up
```

## Project layout

```
prisma/                Prisma schema, migrations, seed script
src/
  app/
    login/              Public login page + server action
    (app)/               Authenticated shell (sidebar/topbar) + pages
      leads/               Leads list + detail (tabs: info/timeline/calls/followups/notes)
      followups/           Today's / overdue follow-up queues
      telecalling/         Fast call-queue workspace (quick outcome buttons)
      pipeline/            Drag-and-drop kanban board (dnd-kit)
      dealers/             Dealers list + detail (tabs: info/timeline/documents/followups/orders/notes), onboarding board
      factory-visits/      Cross-lead visits list (also on the lead profile's Visits tab)
      products/, orders/   Product catalog admin + orders list (also an Orders tab on dealer profile)
      reports/             Overview funnel + telecaller-performance/lead-source/geography sub-reports
      import/, export/     CSV lead import wizard (preview→commit) + CSV export
      settings/            Lookup/config admin: leads, followups, dealers, users; audit-logs list page
    api/v1/               Route handlers — thin, call services/
  lib/
    auth/                 Password hashing, sessions, current-user helpers
    rbac/                  Permission keys, role→permission matrix, visibility scoping
    leads/                 Lead-module constants (follow-up cadence, telecaller status limits)
    dealers/                Dealer-module constants (onboarding sequence, doc types, code-issue status)
    pipeline/               Kanban board constants (excluded statuses, column card limit)
    validation/            Zod schemas
    queues.ts              BullMQ queue definitions (producer side)
    format.ts               Locale-fixed date formatting (avoids SSR/client hydration mismatches)
    storage.ts              Object storage abstraction (local-disk driver; S3/MinIO driver not yet implemented)
    csv.ts                  Minimal CSV parse/stringify for import/export
  services/                Business logic (auth, users, leads, followups, calls, notes, telecalling, pipeline,
                           dealers, dealer-documents, factory-visit, product, order, reports, import, export,
                           settings, audit log)
  repositories/            Prisma queries
  components/              UI (layout/, leads/, followups/, pipeline/, dealers/, reports/, settings/)
  worker/                  BullMQ worker process — follow-up scheduling + daily overdue detection
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run worker` | Start the BullMQ worker (watch mode) |
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (prod, non-interactive) |
| `npm run db:seed` | Seed roles, permissions, lookups, Super Admin |
| `npm run db:studio` | Prisma Studio |
