# 🎮 Minecraft Panel

A self-hosted web control panel for a single Minecraft server. Built with **Next.js 16**, deployed on a VPS via **Coolify**, and fronted by a **Caddy** reverse proxy.

---

## ✨ Features

| Section | What you can do |
|---|---|
| **Dashboard** | Live server status, uptime, CPU & memory usage, start / stop / restart |
| **Console** | Real-time Minecraft server log stream over WebSocket; send commands |
| **Players** | Online player list with NBT inventory, ender chest, health, position |
| **Whitelist** | Add / remove whitelist entries |
| **World** | Download, upload, or reset the world; create & restore backups |
| **Mods** | Install / remove Modrinth projects from the server |
| **Network** | Bedrock (Geyser) bridge status and connection info |
| **Settings** | Change server version, type (Vanilla/Fabric/Paper), `server.properties` |

---

## 🏗️ Architecture

```
                  ┌─────────────────────────────────────┐
internet ──HTTPS──▶    Caddy (reverse proxy + TLS)       │
                  └──────────────┬──────────────────────┘
                                 │ :3000
                  ┌──────────────▼──────────────────────┐
                  │  panel container  (Next.js 16)       │
                  │   • REST API  /api/**                │
                  │   • WebSocket /ws  (live console)    │
                  │   • SQLite  /app/data/              │
                  └──────┬───────────────┬──────────────┘
           Docker socket │               │ mc-data volume
                  ┌──────▼──────┐  ┌────▼────────────────┐
                  │  mc         │  │  mc-data volume      │
                  │  container  │  │  (world + server     │
                  │  :25565     │  │   files owned        │
                  │  RCON :25575│  │   uid 1000)          │
                  └─────────────┘  └─────────────────────┘
                  ┌─────────────┐
                  │  geyser     │  Bedrock ↔ Java bridge
                  │  :19132/udp │
                  └─────────────┘
```

Three Docker services defined in `docker-compose.yml`:

| Container | Image | Role |
|---|---|---|
| `mc` | `itzg/minecraft-server` | Minecraft Java server (uid 1000) |
| `panel` | `omsharma050322/mc-panel` | This web UI |
| `geyser` | `itzg/geyser` | Bedrock-to-Java bridge |

**Two named volumes:**
- `mc-data` — world data, owned by uid 1000. The panel mounts it at `/mc-data`.
- `panel-data` — panel SQLite database, temp files, and local backup ZIPs.

> [!WARNING]
> `/app/data` and `/mc-data` are **different filesystems**. Never use `fs.rename()` across them — it throws `EXDEV`. Use the `moveDir()` helper in [`lib/backup.ts`](panel/lib/backup.ts) instead.

> [!CAUTION]
> Any world files the panel writes (restore / upload) must be `chown -R 1000:1000`'d afterward, or the Minecraft server will crash with `AccessDeniedException: ./world/session.lock`.

---

## 📁 Project Structure

```
minecraft-panel/
├── docker-compose.yml            # Local dev (builds panel from source)
├── docker-compose.coolify.yml    # Production (uses pre-built image)
├── docker-compose.prod.yml       # Minimal prod override
├── Caddyfile                     # Caddy reverse proxy config (auto TLS)
├── .env.example                  # Copy → .env, fill in secrets
└── panel/                        # Next.js application
    ├── server.js                 # Custom HTTP server (Next + WebSocket on :3000)
    ├── ws-server.js              # WebSocket handler — live log streaming
    ├── middleware.ts             # JWT auth guard (all routes except /login)
    ├── Dockerfile                # Multi-stage Docker build
    ├── app/
    │   ├── (panel)/              # Authenticated panel pages
    │   │   ├── dashboard/
    │   │   ├── console/
    │   │   ├── players/
    │   │   ├── whitelist/
    │   │   ├── world/
    │   │   ├── mods/
    │   │   ├── network/
    │   │   └── settings/
    │   ├── api/                  # REST API routes
    │   │   ├── auth/
    │   │   ├── server/           # start, stop, restart, status, logs, properties, version, mods, idle-shutdown
    │   │   ├── players/
    │   │   ├── world/            # download, upload, reset
    │   │   ├── backups/          # create, restore
    │   │   ├── whitelist/
    │   │   └── geyser/
    │   └── login/
    └── lib/
        ├── auth.ts               # JWT sign / verify helpers
        ├── config.ts             # Env-var config (single source of truth)
        ├── docker.ts             # Dockerode wrapper (status, start/stop, exec)
        ├── rcon.ts               # RCON client (TCP → docker-exec fallback)
        ├── nbt-reader.ts         # Parse player .dat NBT files
        ├── backup.ts             # Zip, restore, retention, moveDir()
        ├── gdrive.ts             # Google Drive mirror (service account)
        ├── db.ts                 # SQLite: backup records + player history
        ├── mojang.ts             # UUID → name + skin (offline-mode fallback)
        └── scheduler.ts          # node-cron: scheduled backups + idle shutdown
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites

- Docker & Docker Compose
- Node.js 22+ and [pnpm](https://pnpm.io/) (`npm i -g pnpm`)

### 1 — Clone and configure

```bash
git clone <repo-url>
cd minecraft-panel
cp .env.example .env
```

Edit `.env`:

```env
ADMIN_PASSWORD=your_strong_password
JWT_SECRET=<run: openssl rand -hex 32>
RCON_PASSWORD=your_rcon_password
WORLD_NAME=world
SERVER_ADDRESS=localhost:26666
```

### 2 — Start all containers

```bash
docker compose up -d
```

This builds the panel image locally, then starts `mc`, `geyser`, and `panel`.

| Service | URL |
|---|---|
| Panel UI | http://localhost:3000 |
| Minecraft (Java) | localhost:26666 |
| Minecraft (Bedrock) | localhost:19132/udp |

### 3 — Panel dev (hot reload)

```bash
cd panel
pnpm install
pnpm dev        # starts node server.js in dev mode on :3000
```

> [!NOTE]
> `pnpm dev` requires a running `mc` Docker container to be reachable on the Docker socket and via RCON.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_PASSWORD` | ✅ | `changeme` | Panel login password |
| `JWT_SECRET` | ✅ | insecure dev value | 32-byte hex secret for session tokens |
| `RCON_PASSWORD` | ✅ | `minecraft` | Must match the `mc` container's RCON password |
| `MC_CONTAINER` | | `mc` | Docker container name of the Minecraft server |
| `MC_DATA_PATH` | | `/mc-data` | Mount path of the mc-data volume inside the panel |
| `WORLD_NAME` | | `world` | Subfolder name under `MC_DATA_PATH` |
| `SERVER_ADDRESS` | | `localhost:26666` | Address shown to players in the UI |
| `RCON_HOST` | | `localhost` | Hostname to reach RCON (use `mc` in Docker networking) |
| `RCON_PORT` | | `25575` | RCON port |
| `PANEL_DATA_DIR` | | `./data` | Where SQLite DB and backup ZIPs are stored |
| `BACKUP_SCHEDULE` | | _(off)_ | Cron expression for auto-backups, e.g. `0 */6 * * *` |
| `BACKUP_RETENTION_DAYS` | | `7` | Delete local backups older than N days |
| `GDRIVE_SERVICE_ACCOUNT_KEY` | | _(off)_ | Full service-account JSON (one line) for Drive mirroring |
| `GDRIVE_FOLDER_ID` | | _(off)_ | Google Drive folder ID to upload backups into |

---

## 🐳 Deployment (Coolify + VPS)

The production stack uses **`docker-compose.coolify.yml`**, which pulls the pre-built panel image instead of building from source.

### How it works

- **Coolify** manages and auto-deploys the **`panel`** container on push to `main`.
- **`mc`** was started once by hand and is **not** tracked by Coolify — redeploying the panel does **not** recreate `mc`.
- **Caddy** (or Coolify's built-in Traefik) terminates TLS and reverse-proxies to `panel:3000`.

### Publish a new panel release

```bash
git push origin main   # Coolify auto-deploys the panel container
```

### Rebuild and push the panel Docker image manually

```bash
cd panel
docker build -t omsharma050322/mc-panel:latest .
docker push omsharma050322/mc-panel:latest
```

---

## 🆘 Ops Runbook

### `mc` container missing (panel shows 404 error)

The world volume is safe — just recreate the container:

```bash
# 1. Find the RCON password the panel expects
docker inspect <panel-container-name> \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep RCON_PASSWORD

# 2. Recreate mc
docker run -d \
  --name mc \
  --network coolify \
  -p 26666:25565 \
  -e EULA=TRUE \
  -e TYPE=VANILLA \
  -e VERSION=26.2 \
  -e ONLINE_MODE=FALSE \
  -e MEMORY=3G \
  -e USE_AIKAR_FLAGS=true \
  -e ENABLE_RCON=true \
  -e RCON_PORT=25575 \
  -e RCON_PASSWORD=<from step 1> \
  -e ENABLE_WHITELIST=false \
  -e ENFORCE_WHITELIST=false \
  -e OVERRIDE_WHITELIST=false \
  -e MOTD="Personal server - powered by MC Panel" \
  -v mc-data:/data \
  --restart unless-stopped \
  itzg/minecraft-server:latest

# 3. Fix world file ownership
docker exec -u 0 mc chown -R 1000:1000 /data
docker restart mc
docker logs -f mc   # wait for "Done" before expecting panel to show Online
```

### Fix world file ownership without a full redeploy

```bash
docker exec -u 0 mc chown -R 1000:1000 /data/world
docker restart mc
```

### Find the panel's Coolify container name

```bash
docker ps | grep panel
# or
docker inspect <candidate> | grep -i garcade   # look for COOLIFY_FQDN
```

---

## 🔑 Authentication

- Single-admin model — one `ADMIN_PASSWORD` for the whole panel.
- Successful login issues a JWT stored in an `HttpOnly` cookie (`mcpanel_session`).
- [`middleware.ts`](panel/middleware.ts) guards every route/API except `/login` and `/api/auth`.
- WebSocket upgrades at `/ws` verify the same JWT cookie before accepting.

---

## 🔌 Key Libraries

| Library | Purpose |
|---|---|
| `next` 16 | App Router, React Server Components |
| `dockerode` | Programmatic Docker API (start/stop/exec/stats) |
| `rcon-client` | TCP RCON to send commands to the Minecraft server |
| `better-sqlite3` | Synchronous SQLite (backup records, player history) |
| `ws` | WebSocket server for live console streaming |
| `prismarine-nbt` | Parse binary NBT from player `.dat` files |
| `archiver` / `extract-zip` | ZIP world for backups / restore |
| `googleapis` | Upload backups to Google Drive via service account |
| `node-cron` | Scheduled auto-backups and idle-shutdown logic |
| `jose` | JWT sign / verify |

---

## 🛠️ Development Notes

### Commands (run inside `panel/`)

```bash
pnpm dev          # development server with hot reload
pnpm build        # production Next.js build
pnpm start        # production server (node server.js)
pnpm lint         # ESLint
npx tsc --noEmit  # type-check (tsc/eslint are skipped during pnpm build)
```

### Conventions

- **Offline-mode server** (`ONLINE_MODE=FALSE`): player UUIDs are offline-generated. Name resolution uses `usercache.json` as primary source, with Mojang API as fallback.
- **Cross-volume file moves**: use `moveDir()` from [`lib/backup.ts`](panel/lib/backup.ts) — never `fs.rename()`.
- **World file ownership**: always `chown -R 1000:1000` any world files the panel writes.
- **Commit style**: [Conventional Commits](https://www.conventionalcommits.org/) with scopes `(panel)` or `(deploy)`.
- **TypeScript errors**: `next build` skips tsc. Run `npx tsc --noEmit` before pushing.

### WebSocket console

The `/ws` endpoint is handled by [`ws-server.js`](panel/ws-server.js) attached to the same Node HTTP server as Next. It:
1. Authenticates the upgrade request via the JWT cookie.
2. Opens a `docker.logs({ follow: true })` stream from the `mc` container.
3. Demuxes Docker's 8-byte framed log format into plain lines.
4. Keeps a 200-line ring buffer and replays it to new clients.
5. Auto-reconnects the log stream if the container restarts.

---

## 📄 License

Private / personal project.

