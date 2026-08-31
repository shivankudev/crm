@AGENTS.md

# Gatti E-Rickshaw CRM

Leads, dealers, orders, a telecalling queue with cadence rules, and WhatsApp
messaging through a self-hosted OpenWA gateway. Next.js + Prisma + Postgres +
Redis/BullMQ, all of it in Docker Compose.

## First: work out which machine you are on

This repo lives in two places and the rules are different in each.

**macOS — the development machine.** Normal work happens here. Dev server,
browser preview, edit and verify freely, commit and push.

**Windows — the production mini PC in the office.** Telecallers are using this
right now. You are here to *operate and diagnose*, not to develop. See below.

## On the Windows mini PC

First establish which of two situations you are in, because the rules below
are written for the second and are wrong for the first.

**Setting it up for the first time.** Nothing is running, nobody is on the
phones, and there is nothing yet to protect. Installing Docker, cloning,
writing `.env`, `docker compose up -d --build`, creating the first accounts —
all of that is the job, so get on with it. `.env` is gitignored, so writing it
leaves the tree clean. Follow `windows/SETUP.md` in order rather than
improvising: a wrong `NEXT_PUBLIC_APP_URL`, or a `NODE_ENV` left at
`development`, is not obvious afterwards and nobody thinks to check it.

**Operating it afterwards.** From the moment telecallers depend on it, treat
the running system as the thing you are protecting.

**Do:** read logs, inspect state, explain what broke, restart a wedged
service, run `windows\update.bat` and interpret it if it fails.

**Do not edit source files here.** There is no dev server and no preview on
this box, so a change goes straight to the people on the phones with nothing
between. It also breaks updates: `update.bat` uses `git pull --ff-only`, which
deliberately refuses to run against a dirty tree, so a loose edit here blocks
every future update until someone untangles it. Changes belong on the Mac and
arrive through `update.bat`.

The exception is a genuine emergency — the CRM is down and nobody is at the
Mac. Then fix it, but **commit it before you finish**, or the Mac will collide
with it on the next update.

### Never run this

```
docker compose down -v
```

`-v` deletes the named volumes. That is the entire database, every uploaded
file, and every telecaller's WhatsApp login — with no copy anywhere else on
the machine. Use `docker compose down` or `restart` instead. Before anything
that touches the database, take a dump first (see MIGRATION_GUIDE.md).

### Safe to run

```
docker compose ps                  # what's up
docker compose logs -f web         # app
docker compose logs -f worker      # follow-ups, overdue sweep
docker compose logs -f openwa      # WhatsApp gateway
docker compose restart openwa      # unwedge WhatsApp
```

## Decisions that look like bugs but are not

A session arriving cold tends to "fix" these. Don't, without asking.

- **WhatsApp status is `ready`, never `connected`.** That is OpenWA's own
  enum. Test it with `isWhatsAppLive()` from `src/lib/whatsapp-constants.ts` —
  comparing against `"connected"` silently drops every message.
- **OpenWA runs the Baileys engine**, deliberately. whatsapp-web.js spawned a
  Chromium per session and ate the mini PC's memory.
- **The overdue sweep runs on an interval** (on boot, then hourly) rather than
  at a wall-clock time, because this PC is switched off overnight and a 00:05
  cron would simply never fire.
- **Postgres, Redis and OpenWA bind to `127.0.0.1`**, not the LAN. Only the
  web app is meant to be reachable from other desks.
- **`prisma/seed.ts` only creates what is missing.** It must never overwrite
  anything editable in Settings — it used to reset the cadence rules on every
  `docker compose up`.
- **Quick-send buttons with no message, file or location are hidden from
  callers**, even when enabled. An empty button used to appear the instant an
  admin typed a label and then error mid-call.

## House style

Match the surrounding code. Comments explain *why*, not what. Type sizes here
run small and compact — see the memory on this project's type scale before
resizing anything.
