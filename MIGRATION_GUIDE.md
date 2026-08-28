# Gatti E-Rickshaw CRM — setup on the Windows mini PC

Built for how this machine is actually used: **switched off every evening,
switched on again next morning.** Everything below is designed so that after
the one-time setup, a normal shutdown and power-on needs **no manual steps at
all** — no re-scanning WhatsApp, no starting services by hand.

---

## What's in this folder

| File | What it is |
|---|---|
| `gatti-crm-source.zip` | The full application source |
| `gatti_crm_db.dump` | Your live database (leads, users, follow-ups, WhatsApp config) |
| `.env` | Production settings — **you must edit the marked values** |
| `MIGRATION_GUIDE.md` | This file |

**How it's used:** the mini PC runs everything; telecallers do *not* install
anything. They open `http://<mini-pc-ip>:3000` in a browser on their own
machine or phone and sign in with their own account. Each links their own
WhatsApp once from that browser.

---

## One-time setup

### 1. Install Docker Desktop

Download from <https://www.docker.com/products/docker-desktop/> and install.
When it asks, enable the **WSL 2** backend.

### 2. Make Docker start by itself

This is the step that makes the nightly power cycle work. In Docker Desktop:

**Settings → General → ✅ Start Docker Desktop when you sign in**

Docker only starts once somebody is **signed in to Windows**. If the PC boots
to a locked login screen, nothing runs. Either:

- have whoever opens the office sign in each morning (simplest), **or**
- set up Windows automatic sign-in so it reaches the desktop unattended
  (`netplwiz` → untick "Users must enter a user name and password").

Automatic sign-in means anyone who powers on the PC gets a logged-in desktop —
fine for a locked office, not for a shared space. Your call.

### 3. Unpack the app

Create `C:\gatti-crm` and extract `gatti-crm-source.zip` into it. Copy `.env`
into that same folder, next to `docker-compose.yml`.

### 4. Edit `.env`

Open it in Notepad and change:

- `POSTGRES_PASSWORD` — pick a real password (and put the same value inside
  `DATABASE_URL`)
- `SEED_SUPER_ADMIN_PASSWORD` — your first login password
- `NEXT_PUBLIC_APP_URL` — this PC's LAN IP, e.g. `http://192.168.1.50:3000`
  (find it with `ipconfig` in Command Prompt — look for IPv4 Address)

`SESSION_SECRET` is already generated for this machine. Leave `OPENWA_API_KEY`
blank — the app reads the gateway's key automatically from the shared data
volume, so there is nothing to copy across.

### 5. First start

Open **PowerShell** in `C:\gatti-crm`:

```powershell
docker compose up -d --build
```

First run takes several minutes (it builds the app and downloads images).
Watch it come up with:

```powershell
docker compose ps
```

Then restore your data:

```powershell
docker compose cp gatti_crm_db.dump postgres:/tmp/db.dump
docker compose exec postgres pg_restore -U gatti_crm -d gatti_crm --clean --if-exists /tmp/db.dump
```

> PowerShell does not support `<` input redirection, which is why this uses
> `docker compose cp` instead of piping the file in.

### 6. Let the other PCs reach it

Two things, or the CRM will only open on the mini PC itself.

**Give this PC a fixed address.** Everyone will bookmark it by IP, so it must
not change. Either reserve it on the router (DHCP reservation against the PC's
MAC — the tidiest), or set a static IP in Windows: Settings → Network →
Ethernet → IP assignment → Edit → Manual.

Put that address in `.env` as `NEXT_PUBLIC_APP_URL`, e.g.
`http://192.168.1.50:3000`, then `docker compose up -d` to apply it.

**Open port 3000 in Windows Firewall.** Windows blocks it by default, so
without this other machines just time out. In PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Gatti CRM" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

`-Profile Private` limits it to networks Windows treats as private — make sure
the office network is set to **Private**, not Public, under Settings → Network.

Check from another machine: `http://<pc-ip>:3000` should load the login page.

> Only port 3000 is published to the network. The database, Redis and the
> WhatsApp gateway are deliberately bound to the PC itself and are not
> reachable from other machines, even though they run in the same stack.

### 7. Link each telecaller's WhatsApp

Each telecaller signs in, opens **WhatsApp** in the sidebar, and scans the QR
with their own phone (WhatsApp → Linked Devices → Link a Device).

This is a **one-time** action per person. The linked device survives every
future shutdown — see below.

---

## Every day after that

**Evening:** shut Windows down normally (Start → Shut down). Use a normal
shutdown, not a hard power-cut at the wall — it lets WhatsApp's browser
session close cleanly, which avoids the occasional need to re-scan.

**Morning:** power on and sign in to Windows. That's it.

Docker starts, every service comes back on its own, each telecaller's WhatsApp
reconnects from the credentials stored on disk, and the first thing the worker
does is sweep for anything that fell overdue while the machine was off. Give
it about a minute after sign-in before expecting the CRM to answer.

Staff open `http://<this-pc-ip>:3000` from any machine on the office network.

### Why nothing needs restarting

- Every service is set to `restart: unless-stopped`, so Docker brings them all
  back when it starts.
- Database, Redis, uploaded files, and WhatsApp credentials each live in a
  named Docker volume, so they survive restarts and rebuilds.
- Redis runs with append-only persistence, so queued background work isn't
  lost on an unclean stop.
- OpenWA runs with `AUTO_START_SESSIONS=true`, so linked phones reconnect
  without a QR scan.
- The app reads the gateway's API key straight from the shared volume, so
  there is no key to keep in sync by hand.
- The overdue sweep is **not** tied to a clock time. It runs once when the
  worker starts and then hourly while it's running — so it can't be missed by
  the machine being off at the wrong moment, and it doesn't care if office
  hours change.

---

## Getting later changes onto this PC

The first install above is a one-off. After that, changes made on the Mac
reach this machine through Git — no more zip files, and every version is
recorded so a bad change can be undone.

### One-time, on this PC

Install Git for Windows (<https://git-scm.com/download/win>), accept the
defaults, then in PowerShell:

```powershell
cd C:\
git clone <repository-url> gatti-crm-new
```

Move your existing `.env` into the new folder, stop the old stack, and start
the new one from `C:\gatti-crm-new`. The Docker volumes are named, not tied
to the folder, so the database, uploaded files and WhatsApp logins all carry
over untouched. Once it's up, delete the old folder and rename the new one to
`C:\gatti-crm`.

### Every time after that

Double-click **`windows\update.bat`**. It:

1. dumps the database into `backups\` first,
2. downloads the new version,
3. rebuilds the app,
4. applies any database changes,
5. restarts everything.

It stops at the first thing that fails and leaves the old version running, so
a failed update is never a broken CRM. The site is unreachable for roughly a
minute at step 5 — run it outside calling hours where you can.

If something looks wrong straight after an update, double-click
**`windows\rollback.bat`**. It puts the previous version back. It does not
undo a database change, so if the app still misbehaves, restore the newest
file in `backups\`:

```powershell
docker compose cp backups\before-update-XXXXXXXX-XXXXXX.dump postgres:/tmp/db.dump
docker compose exec postgres pg_restore -U gatti_crm -d gatti_crm --clean --if-exists /tmp/db.dump
```

### Making it update itself

Run **`windows\register-auto-update.bat` once, as Administrator**
(right-click → Run as administrator). From then on, a couple of minutes
after each morning's sign-in the PC checks GitHub and updates itself if
anything was published.

When there is nothing new it does nothing at all, so it is safe to leave
on. When there is, it takes the same care `update.bat` does: database
backup first, and it stops at the first failure with the old version still
running. Everything it did is in `logs\auto-update.log`.

Sign-in was chosen deliberately over a during-the-day schedule: an update
restarts the CRM for about a minute, and first thing in the morning is the
one time nobody is mid-call.

To stop it:

```powershell
schtasks /delete /tn "Gatti CRM auto-update" /f
```

You can still run `update.bat` by hand any time you want a change sooner.

> There is no "live editing" on this machine. It runs a compiled build for
> speed and safety, so a code change needs the short rebuild above — it is
> not a development server that picks up edited files.

### The other half, on the Mac

Changes are made and tested on the Mac, then pushed. Nothing is ever edited
directly on the mini PC — if a file here is changed by hand, `update.bat`
refuses to run rather than overwrite it, and that has to be sorted out before
updates work again.

---

## Pulling leads in from Google Sheets

New rows in a linked sheet become leads on their own — checked every ten
minutes, and again whenever this PC starts up. Set up under
**Settings → Google Sheet lead sources**. Admins only; telecallers cannot see
or change it.

Each sheet needs a header row, and at minimum a **name** and a **phone**
column — `Phone 1`, `Mobile` and `Contact Number` all count as the phone,
and `Phone 2` is picked up as the alternate number. `email`, `interested product` and `temperature` are used if present
and ignored if not. Rows missing a name or a usable phone number are skipped
and counted, not silently dropped.

Assign one telecaller to a sheet and every lead from it is theirs. Assign
several and the rows are dealt out between them in turn, so a shared sheet
splits evenly. The rotation is remembered, so a restart doesn't send the next
batch back to the first person.

### Which access mode

**Private sheet (recommended for real lead data).** The sheet stays private
and is read through a Google service account. One-time setup:

1. Go to <https://console.cloud.google.com/> and create a project (any name).
2. **APIs & Services → Library**, search "Google Sheets API", press **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Give it a name; no roles or user access are needed. Create it.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads.
5. Put that file in `C:\gatti-crm\secrets\` as `google-service-account.json`,
   and set this in `.env`:

   ```
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/run/secrets/google-service-account.json
   ```

6. `docker compose up -d` to pick it up.
7. In each Google Sheet: **Share** → paste the service account's email
   address (it ends `.iam.gserviceaccount.com`, and the CRM shows it on the
   settings page) → give it **Viewer** → Send.

**Link-shared sheet.** No credentials and no setup:

1. Open the sheet, press **Share**, and under **General access** choose
   **Anyone with the link** → **Viewer**.
2. Copy the link straight out of the browser's address bar — the ordinary
   `.../spreadsheets/d/<id>/edit?gid=<tab>` one. There is nothing to
   publish; the CRM works out the export address itself, and reads the tab
   the link points at.

Be aware that a link-shared sheet can be read by anyone who has that link,
without signing in — including the customer names and phone numbers in it.
Fine for an intake sheet, but a private sheet is safer for anything more.

### What it will and won't do

- It looks at every row each time and decides what is new by **phone
  number**, not by position. Rows added in the middle (which is where a
  Google Form drops them on a sheet padded with blank rows), sorted, or
  moved are all picked up correctly.
- Editing a row that was already imported does not update the lead — the
  sheet is an inbox, not a mirror.
- Blank padding rows are skipped and counted, not treated as errors.
- A phone number already in the CRM is skipped as a duplicate and counted.
- Imported leads get their follow-up scheduled as normal but **no welcome
  WhatsApp**, deliberately: a sheet can drop a hundred rows at once, and one
  message per row is the burst pattern that gets a number banned.
- If a sheet can't be read, the reason is shown on its card in Settings and
  the other sheets carry on regardless.
- **Sync now** on any sheet runs the same import immediately.
- The dashboard shows **New leads today**. Clicking it opens a breakdown of
  where they came from — each linked sheet, and each person who typed one in
  by hand — and clicking any line there opens exactly those leads. Every
  figure is scoped: an admin sees the day's whole intake, a telecaller only
  the rows dealt to them. Counted by the Asia/Kolkata day, so it does not
  reset mid-afternoon.

---

## If something looks wrong

**CRM won't load on the mini PC itself.** Check Docker Desktop is running and
somebody is signed in to Windows. Then `docker compose ps` — anything not
`running` or `healthy`, look at `docker compose logs <service>`.

**CRM loads on the mini PC but not from other machines.** That's almost always
one of three things, in this order: the firewall rule from step 6 is missing,
the office network is set to **Public** instead of Private (the rule is
scoped to Private), or the PC's IP changed and people are using the old one.
Confirm the current address with `ipconfig` on the mini PC.

**WhatsApp shows "Not connected".** Open the WhatsApp page and press **Refresh
QR**, then re-scan. A device can be unlinked by WhatsApp itself (removed from
the phone's Linked Devices, or a long offline stretch) — no configuration
prevents that.

**WhatsApp says "Connected" but messages aren't arriving.** The gateway can
occasionally wedge: connected on paper, unable to send. Messages will show as
**Failed** on the dashboard. Fix:

```powershell
docker compose restart openwa
```

Then re-check the WhatsApp page; re-scan only if it asks.

**Start clean without losing data:**

```powershell
docker compose down
docker compose up -d
```

`docker compose down` stops containers but keeps volumes — your data is safe.
Do **not** add `-v`: that deletes the volumes, which means the database, the
uploaded files, **and** every linked WhatsApp device — everyone has to
re-scan their QR.

---

## Useful commands

```powershell
docker compose ps                    # what's running
docker compose logs -f web           # app logs
docker compose logs -f worker        # background jobs (follow-ups, overdue sweep)
docker compose logs -f openwa        # WhatsApp gateway
docker compose restart openwa        # unwedge WhatsApp
docker compose up -d                 # apply .env changes
```

### Backups

The database lives in a Docker volume on this one PC. Nothing else has a copy.
Take a dump periodically and put it somewhere off this machine:

```powershell
docker compose exec postgres pg_dump -U gatti_crm -Fc gatti_crm > backup.dump
```

Worth scheduling weekly via Windows Task Scheduler.
