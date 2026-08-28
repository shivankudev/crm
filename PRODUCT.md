# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal staff at Gatti E-Rickshaw, working from office desktops:

- **Telecallers** — work an assigned queue of leads, log calls, record outcomes, and manage their own follow-ups. Can only see and act on leads assigned to them, and can only move a lead through a limited, configurable set of statuses.
- **Sales Managers** — see and manage their team's leads and dealers, assign/reassign leads within their team, view team performance reports, and handle dealer follow-ups.
- **Admins** — full lead/dealer/product/order management, partial user management, partial settings access, and view-only audit logs.
- **Super Admin** — full access to everything, including user/role/permission management and all settings.

## Product Purpose

An internal CRM that replaces a Google Sheets–based telecalling workflow for selling e-rickshaws. It exists so the sales team can manage leads and dealers through a structured pipeline instead of flat spreadsheets — with proper lead lifecycle tracking, scheduled/overdue follow-ups, a fast call-queue workspace, dealer onboarding through to dealer-code issuance, factory visit tracking, product/order management, and reporting. Success is the sales floor running entirely off this tool with nothing falling through the cracks that a spreadsheet used to lose (missed follow-ups, duplicate leads, no visibility into rep performance).

## Positioning

Not a generic CRM — it is built around this specific sales motion: a lead pipeline that ends in either a factory visit and dealer conversion, or a consumer sale, with dealer onboarding modeled as its own lifecycle (prospect → verification → agreement → dealer-code issuance → active dealer). Follow-up cadences are rule-driven and auto-scheduled by a background worker rather than manually tracked, and every mutation is written to an append-only activity/audit trail — the things a spreadsheet workflow structurally cannot do.

## Operating Context

- Desktop web, used from the office (deployed to a VPS or an office mini-PC via Docker Compose) — not a mobile/field tool today. Mobile use is not a design target; a session confirmed office-desktop is the primary and intended context.
- Statuses, sources, lost-reasons, and follow-up interval rules are admin-configurable data, not hardcoded — Settings pages are a real, regularly-used part of the product, not a rare admin corner.
- Role/permission matrix is itself data-driven and editable from Settings, so RBAC-scoped UI (what a given role can see/do) is a first-class, everyday concern, not an edge case.
- English-only interface; no localization requirement.

## Capabilities and Constraints

- Stack: Next.js (App Router) + TypeScript + Tailwind v4, PostgreSQL via Prisma, Redis + BullMQ for background jobs (follow-up scheduling, overdue detection), local-disk object storage (S3/MinIO driver not yet implemented).
- All nine planned build phases are complete: foundation/auth/RBAC, leads & follow-ups, telecalling & pipeline kanban, dealers, factory visits, products & orders, reports, import/export, settings & audit logs.
- Not built yet: a dedicated Tasks/Calendar UI (the `Task` model exists, no page), in-app notifications, S3/MinIO storage, and full India district/city data (states only).
- Server-side pagination is required for lead/dealer lists at scale (100k+ records is a stated target) — not a client-heavy SPA pattern.

## Brand Commitments

No binding brand identity exists outside this codebase — confirmed there is no separate logo, color palette, or brand guide to match. The current UI (indigo brand accent, a placeholder "Zap" glyph as the wordmark's icon) is a scaffold default, not a committed identity. Future visual work has a free hand on theming.

## Evidence on Hand

No real leads, dealers, call transcripts, or performance data exist in the repo to draw from — treat any numbers, names, or sample content in UI or reports as placeholder, and do not fabricate testimonials, metrics, or case studies. The seed script produces roles/permissions/lookup data and one Super Admin account, not representative business content.

## Product Principles

- Nothing gets lost. Every lead/dealer action writes to an append-only activity log; nothing is silently overwritten.
- Configuration over hardcoding. Statuses, sources, lost-reasons, follow-up rules, and the permission matrix are admin-editable data, so the product must keep working correctly as admins change these without a deploy.
- Role visibility is structural, not cosmetic. What a user can see and act on (own leads vs. team vs. all) is core to every list/detail view, not an afterthought filter.
- Speed for the telecaller's queue. The daily call workflow (queue → call → outcome → next) is the highest-frequency, highest-value interaction and should stay fast and low-friction above all other surfaces.
- Office-desktop first. Design and interaction decisions should optimize for desktop office use, not assume mobile/field usage.
