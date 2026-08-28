# Gatti E-Rickshaw CRM — System Design

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                      │
│   Next.js App Router (React 18, TS, Tailwind)                 │
│   - Telecaller Workspace   - Manager Dashboard                │
│   - Dealer Module          - Pipeline Kanban                  │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS (session cookie)
┌───────────────▼─────────────────────────────────────────────┐
│                  NEXT.JS SERVER (Node.js)                     │
│  - Server Actions / Route Handlers (REST-ish, typed)           │
│  - Auth (Lucia/NextAuth-style session, RBAC middleware)        │
│  - Zod validation on every mutation                            │
└──────┬───────────────┬──────────────────┬─────────────────────┘
       │                │                  │
┌──────▼──────┐  ┌──────▼───────┐   ┌──────▼───────────┐
│ PostgreSQL   │  │ Redis        │   │ Object Storage    │
│ (Prisma ORM) │  │ (BullMQ jobs)│   │ (dealer docs,      │
│ primary DB   │  │ - followup   │   │ factory-visit      │
│              │  │   scheduler  │   │ photos)             │
│              │  │ - overdue    │   │ Local disk or S3-   │
│              │  │   detector   │   │ compatible (MinIO)  │
│              │  │ - notif jobs │   │                     │
└──────────────┘  └──────────────┘   └─────────────────────┘
```

**Deployment:** single `docker-compose.yml` with services `web`, `postgres`, `redis`, `worker` (BullMQ consumer), optional `minio`. Runs on a VPS or a mini PC at the office. Env vars in `.env`, never shipped to the client bundle.

**Why this stack fits the spec:** everything in sections 34 (import), 52 (background jobs), and 46 (100k+ record performance) needs a real job queue and server-side pagination — not a client-heavy SPA hitting Sheets-style flat tables.

---

## 2. Database ERD (core entities)

```
users ──< lead_assignments >── leads ──< follow_ups
  │                                │         (polymorphic: lead_id OR dealer_id)
  │                                ├──< call_activities
  │                                ├──< lead_activities (timeline)
  │                                ├──< notes
  │                                ├──< factory_visits
  │                                └──< attachments
  │
  ├──< dealer_activities >── dealers ──< follow_ups (shared table)
  │                              ├──< dealer_documents
  │                              └──< orders ──< order_items ── products
  │
  ├──< tasks
  ├──< notifications
  └──< audit_logs

leads }o──|| lead_sources
leads }o──|| lead_statuses (configurable)
leads }o──|| states / districts / cities

roles ──< role_permissions >── permissions
users }o──|| roles
```

Key design choices called out in the brief:
- **No `follow_up_1..6` columns.** One `follow_ups` table, `lead_id` and `dealer_id` both nullable with a check constraint that exactly one is set.
- **Statuses, sources, results, lost reasons** are rows in configuration tables (`lead_statuses`, `lead_sources`, `results`, `lost_reasons`), not enums baked into migrations — Admin edits them in Settings.
- **Every mutation writes an activity row.** `lead_activities` / `dealer_activities` are append-only; nothing is overwritten, matching section 36/18.

---

## 3. Role & Permission Matrix

| Capability | Super Admin | Admin | Sales Manager | Telecaller |
|---|---|---|---|---|
| Manage users/roles/permissions | ✅ | Partial (below own scope) | ❌ | ❌ |
| View all leads | ✅ | ✅ | Team only | Assigned only |
| Assign / reassign leads | ✅ | ✅ | ✅ (own team) | ❌ |
| Call / log activity / notes | ✅ | ✅ | ✅ | ✅ (own leads) |
| Create / complete follow-ups | ✅ | ✅ | ✅ | ✅ (own leads) |
| Change lead status | ✅ | ✅ | ✅ | Limited set (configurable) |
| Manage dealers | ✅ | ✅ | View + follow-up | ❌ |
| Approve dealer onboarding stage | ✅ | ✅ | ❌ | ❌ |
| Factory visits (schedule/complete) | ✅ | ✅ | ✅ | Create only |
| View reports / telecaller performance | ✅ | ✅ | ✅ (own team) | Own stats only |
| Import / export | ✅ | ✅ (if granted) | ❌ | ❌ |
| Settings (statuses, intervals, sources) | ✅ | Partial | ❌ | ❌ |
| Audit logs | ✅ | View only | ❌ | ❌ |

Permissions are stored as `role_permissions(role_id, permission_key, allowed)` rows, so this table is data, not code — Super Admin can adjust it from **Users & Permissions** without a deploy.

---

## 4. Lead Lifecycle

```
NEW → CONTACTED → CONNECTED/NOT_CONNECTED → FOLLOW_UP → INTERESTED
    → QUALIFIED → PRICE_SHARED → FINANCE_REQUIRED(optional) → FACTORY_VISIT
    → NEGOTIATION → READY_TO_ORDER → WON
                                    → LOST (requires lost_reason)
Any stage → NOT_INTERESTED / INVALID / DUPLICATE (terminal)
```
Each transition writes a `lead_activities` row (`old_status → new_status`) and, if a follow-up interval rule matches the new status, enqueues the next `follow_ups` row via the BullMQ worker.

## 5. Dealer Lifecycle
```
PROSPECT → CONTACTED → INTERESTED → DOCUMENTS_REQUESTED → DOCUMENTS_RECEIVED
         → VERIFICATION → APPROVED → AGREEMENT → DEALER_CODE issued
         → OPENING_ORDER → ACTIVE_DEALER
(REJECTED / SUSPENDED / INACTIVE reachable from most states)
```

## 6. Follow-up Lifecycle
```
Lead/Dealer event fires → follow_up_rules (configurable N-day intervals) evaluated
  → follow_ups row created (status=PENDING, scheduled_date/time set)
  → shows in "Today's Follow-ups" when scheduled_date = today
  → daily cron flags scheduled_date < today AND status=PENDING → status=OVERDUE
  → user action: COMPLETED (outcome required) | RESCHEDULED (new row, old marked RESCHEDULED)
    | CANCELLED | MISSED
  → on COMPLETED with "continue follow-up" checked, next rule in sequence fires
  → WON/LOST/CLOSED on parent lead/dealer stops the chain (no auto-create)
```

---

## 7. Page Architecture (route map)

```
/login
/dashboard
/leads                      (list, filters, saved views)
/leads/[id]                 (profile: info / follow-ups / calls / notes / visits / docs / timeline)
/followups/today
/followups/overdue
/telecalling                (fast workspace: queue + quick actions)
/pipeline                   (kanban)
/calendar
/tasks
/dealers
/dealers/[id]
/dealers/onboarding
/factory-visits
/products
/orders
/reports
/reports/telecaller-performance
/reports/lead-source
/reports/geography
/import
/export
/notifications
/settings/{general,leads,followups,dealers,products,users}
/audit-logs
```

## 8. API Architecture

REST-ish route handlers under `/api/v1/...`, one resource per file, thin controllers calling a `services/` layer (business logic) which calls `repositories/` (Prisma). All mutations: `zod` schema → permission check middleware → service → activity log write → response. Example surface:

```
GET    /api/v1/leads?state=&status=&owner=&page=&pageSize=
POST   /api/v1/leads                         (runs duplicate check first)
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
POST   /api/v1/leads/:id/calls
POST   /api/v1/leads/:id/followups
PATCH  /api/v1/followups/:id                 (complete/reschedule/cancel)
GET    /api/v1/followups/today
GET    /api/v1/followups/overdue
POST   /api/v1/dealers ...  (mirrors leads)
POST   /api/v1/import/leads/preview
POST   /api/v1/import/leads/commit
GET    /api/v1/reports/telecaller-performance?from=&to=
```

## 9. Component Architecture (frontend)

```
components/
  ui/            shadcn-style primitives (Button, Table, Drawer, Modal, Toast)
  leads/         LeadTable, LeadCard, LeadDrawer, StatusBadge, TemperatureBadge
  telecalling/   CallQueue, QuickActionBar, CallOutcomeForm
  followups/     FollowupList, FollowupKPICards, RescheduleModal
  dealers/       DealerTable, OnboardingStepper, DocumentUploader
  pipeline/      KanbanBoard, KanbanCard (dnd-kit)
  dashboard/     KPICard, ChartCard (recharts)
  timeline/      ActivityTimeline (shared by leads & dealers)
  reports/       ReportFilterBar, PerformanceTable
```

State: server components for data-heavy pages (server-side pagination per §46), client components only for interactive widgets (kanban, call queue, drawers). No Redux needed — server actions + `useOptimistic` for the telecaller queue's speed requirement.
