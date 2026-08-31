# Setting up the office Windows PC

Start to finish on a machine with nothing installed. Work through it in order —
each step assumes the one before it worked.

If you are a Claude session doing this: you are on the mini PC *before* it is in
service, so nothing here is protecting live work yet. Do the steps. The
"treat the running system as the thing you are protecting" rules in CLAUDE.md
begin the moment step 6 succeeds and people start logging in.

## A note on the shell

The commands below are written one per line because Windows PowerShell (the
blue one, version 5) rejects `&&` as a separator — it fails with "The token
'&&' is not a valid statement separator in this version". Run them as separate
lines. PowerShell also needs `.\` in front of a script in the current folder,
so it is `.\windows\update.bat`, not `windows\update.bat`.

`curl` in PowerShell 5 is an alias for something else entirely; where a command
below uses curl, type `curl.exe` so you get the real one.

## Before you start

- Windows 10/11 64-bit, virtualisation enabled in the BIOS
- The GitHub account that can read `shivankudev/crm`
- A wired connection if possible — the first run downloads several GB
- The router's admin password, for step 9

## 1. Install Docker Desktop and Git

Both with default options, from docker.com and git-scm.com. Docker asks to
enable WSL2 — allow it and restart. Then check both answer:

```
docker --version
git --version
```

In Docker Desktop, Settings → General, turn on **Start Docker Desktop when you
sign in**. Without it the CRM stays down after a power cut until somebody
notices and opens Docker by hand.

## 2. Download the CRM

Use HTTPS rather than SSH — Git for Windows opens a browser to sign in, so
there are no keys to set up.

```
cd C:\
git clone https://github.com/shivankudev/crm.git gatti-crm
cd gatti-crm
```

Keep it at `C:\gatti-crm`. Do **not** put it under Documents, Desktop, or
anywhere else OneDrive syncs: OneDrive rewrites files underneath Docker and
corrupts the database.

## 3. Find the PC's address on the network

```
ipconfig | findstr IPv4
```

Note the IPv4 address (something like `192.168.31.60`). You need it in step 4
and again in step 9. This is the address every other desk will use.

## 4. Write the settings file

Passwords are deliberately not in Git, so the repo ships an example and no real
settings.

```
copy .env.example .env
notepad .env
```

Change these five. Everything else can stay as it is.

| Setting | What to put |
| --- | --- |
| `POSTGRES_PASSWORD` | Any strong password. Nobody types this; it is only used between containers. |
| `SESSION_SECRET` | A long random string. It signs everyone's login cookie — leaving the example value means anyone could forge one. |
| `NODE_ENV` | `production`. The example says `development`, and because `env_file` is applied on top of the built image, that value would win and run the office on a development server. |
| `NEXT_PUBLIC_APP_URL` | `http://YOUR-IP:3000` from step 3. Left as `localhost`, links send every other desk back to their own machine. |
| `SEED_SUPER_ADMIN_EMAIL` / `_PASSWORD` | The first login, created automatically on first start. |

For the secret, run this in PowerShell and paste the result:

```
[Convert]::ToBase64String((1..32 | %{ Get-Random -Max 256 }))
```

Leave `SESSION_COOKIE_SECURE` as `false`. It means "only send the login cookie
over HTTPS", and the office runs on plain HTTP — set it true and nobody can log
in at all.

## 5. Start it

Builds the app, pulls Postgres, Redis, the WhatsApp gateway and file storage,
creates the database and loads the starting data. First run takes fifteen
minutes or so; later ones are seconds.

```
docker compose up -d --build
docker compose ps
```

Every row should read `running` or `healthy`. If one says `exited`, read why
with `docker compose logs <service>`.

## 6. Log in and change the password

Open `http://localhost:3000` on the PC and sign in with the admin email and
password from step 4. **Change that password straight away** — it is sitting in
a text file on disk. Then create an account for each telecaller under
Settings → Users.

## 7. Link each telecaller's WhatsApp

Every caller sends from their own number, so each does this once, signed in as
themselves: open WhatsApp in the menu, then on their phone go to
WhatsApp → Linked Devices → Link a Device, and scan.

The code refreshes roughly every twenty seconds — that is normal, and scanning
while it changes is fine. If it does stick, the screen recovers on its own
within a minute.

## 8. Turn on the morning update check

Right-click `windows\register-auto-update.bat` → **Run as administrator**. It
asks Windows to check for new versions two minutes after each sign-in —
deliberately first thing, when nobody is mid-call — and does nothing at all
when there is nothing new.

To update by hand at any time, double-click `windows\update.bat`. It backs the
database up before changing anything.

## 9. Fix the PC's address, then tell everyone

In the router (Jio AirFiber: `https://192.168.31.1`, Network → LAN IPv4 → List
of LAN IPv4 Reserved IPs) reserve the IP from step 3 against this PC's MAC
address — the Physical Address shown by `ipconfig /all`.

Without the reservation the router can hand that address to a different machine
after a reboot, and every desk quietly points at the wrong computer. With it,
this is the permanent address for the CRM:

```
http://YOUR-IP:3000
```

Finally set Windows to never sleep. A sleeping PC takes the CRM down for
everybody.

## Never run this

```
docker compose down -v
```

`-v` deletes the volumes: the entire database, every uploaded file, and every
telecaller's WhatsApp login, with no copy anywhere on the machine. To stop the
CRM use `docker compose down`; to restart it, `docker compose restart`.

## Day to day

| | |
| --- | --- |
| See what is up | `docker compose ps` |
| Read the logs | `docker compose logs -f web` (app), `worker` (follow-ups, overdue sweep), `openwa` (WhatsApp) |
| WhatsApp stopped sending | `docker compose restart openwa` — clears both a wedged gateway and an exhausted rate limit, which look identical from inside the CRM |
| An update went wrong | `windows\rollback.bat`. The dump taken before the update is in `backups\` |

Do not edit source files on this machine — see CLAUDE.md for why.

## Worth doing soon after

**A backup that does not depend on updating.** Today the only dump happens when
`update.bat` runs, and it lands on the same disk as the original. Go a few
weeks without updating and the newest copy is weeks old. A nightly dump copied
to a USB disk or a cloud folder closes both problems.

**Pin the WhatsApp gateway version.** It is pulled as `:latest`, so which
version you get depends on the day you install, and `update.bat` never
refreshes it afterwards — so it stays on that first version indefinitely.
