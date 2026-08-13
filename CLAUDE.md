# CLAUDE.md

Guidance for working in this repo.

## What this is

A self-hosted web control panel for a single Minecraft server. The panel and
the Minecraft server run as two Docker containers sharing one data volume.
Deployed via Coolify on a VPS behind a Caddy/Traefik proxy.

Live server: `minecraft.garcade.in:26666`.

## Architecture

Two containers, defined in `docker-compose.coolify.yml` (production) and
`docker-compose.yml` (local):

- **`mc`** — `itzg/minecraft-server`. Runs as **uid/gid 1000**. World data at
  `/data` inside the container. RCON on port 25575, Minecraft on 25565 (mapped
  to host `26666`).
- **`panel`** — the Next.js app (image `omsharma050322/mc-panel`). Runs as
  **root**. Mounts:
  - the shared `mc-data` volume at `/mc-data` (so it can read/write the world),
  - `/var/run/docker.sock` (so it can start/stop/exec the `mc` container),
  - `panel-data` at `/app/data` (its own SQLite DB, tmp, and backup zips).

**Key gotcha — two volumes, two owners:**
- `/mc-data` (shared world) is owned by uid 1000; the `mc` server crashes with
  `AccessDeniedException: ./world/session.lock` if world files are owned by
  anyone else. After the panel writes world files (restore/upload), it must
  `chown -R 1000:1000` them.
- `/app/data` and `/mc-data` are **different filesystems**. `fs.rename()` across
  them throws `EXDEV`. Use `moveDir()` in `lib/backup.ts` (rename, falling back
  to copy+delete) for any cross-volume move.

## Panel app (`panel/`)

Next.js 16 (App Router, React 19). Custom server (`server.js`) hosts both Next
and a WebSocket endpoint on the same port for live console + status push.

### Routes
- `app/(panel)/` — UI pages: dashboard, console, players, whitelist, world,
  mods, network, settings.
- `app/api/` — REST endpoints: `server/*` (start/stop/restart/status/logs/
  properties/command/version/teams/mods/idle-shutdown), `players/*`,
  `world/*` (download/upload/reset), `backups/*` (create/restore), `whitelist`,
  `auth`.

### `lib/`
- `docker.ts` — dockerode wrapper: container status, start/stop, `execInMc`.
- `rcon.ts` — RCON client (TCP, falls back to `rcon-cli` via docker exec).
  `listPlayers()` parses the `list` output; it throws on connection-failure
  text so callers treat "RCON down" as unavailable, not "0 players".
- `nbt-reader.ts` — reads player `.dat` NBT (inventory, ender chest, position,
  health, death). Armor (NBT slots 100-103) and offhand (-106) live in the same
  `Inventory` list and are remapped to the UI's flat slots (36-39, 40) by
  `remapSlot`.
- `backup.ts` — zip world → local `/app/data/backups` (+ optional Google Drive
  mirror), restore, retention cleanup. Owns `moveDir`.
- `gdrive.ts` — Google Drive backup mirror (service account).
- `db.ts` — better-sqlite3: backup records + player snapshots (history survives
  world resets).
- `mojang.ts` — UUID→name + avatar; offline-mode falls back to
  `usercache.json`.
- `config.ts` — env config. `scheduler.ts` — cron backups + idle shutdown.

### Commands (run inside `panel/`)
- `pnpm dev` — local dev (`node server.js`).
- `pnpm build` — `next build` (tsc/eslint skipped during build; run
  `npx tsc --noEmit` yourself to typecheck).
- `pnpm start` — production.

## Deploy

Coolify auto-deploys on push to `main`. To apply a fix, push then redeploy the
panel app in Coolify. Container names on the VPS are Coolify-hashed except `mc`.

**Important — `mc` is NOT managed by Coolify.** Only the `panel` app is a
tracked Coolify resource (project "Panel" → app `minecraft-panel`,
container name Coolify-hashed, e.g. `pv6ufemqwev2thes7vu51k6h-...`, on the
`coolify` docker network). `mc` was started once by hand from
`docker-compose.coolify.yml` and is *not* part of that Coolify app —
redeploying/restarting the panel app in Coolify does **not** recreate `mc`.
If `mc` is ever removed (manual `docker rm`, prune, host reboot without it
coming back, etc.), the panel dashboard shows:
```
(HTTP code 404) no such container - No such container: mc
```
and nothing in Coolify will fix it — you must recreate the container
manually. The `mc-data` volume persists independently, so world data
survives this.

Ops runbook — recreate `mc` from scratch:
```bash
# get RCON_PASSWORD Coolify's panel container expects (must match, or panel can't RCON in)
docker inspect <panel-container-name> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep RCON_PASSWORD

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
  -e RCON_PASSWORD=<from above> \
  -e ENABLE_WHITELIST=false \
  -e ENFORCE_WHITELIST=false \
  -e OVERRIDE_WHITELIST=false \
  -e MOTD="Personal server - powered by MC Panel" \
  -v mc-data:/data \
  --restart unless-stopped \
  itzg/minecraft-server:latest

docker exec -u 0 mc chown -R 1000:1000 /data
docker restart mc
docker logs -f mc   # wait for "Done" before expecting panel to go Online
```

Find the panel's actual container name (needed above) via:
```
docker inspect <candidate> | grep -i garcade   # look for COOLIFY_FQDN=minecraft.garcade.in
```

Ops runbook, e.g. fix world ownership without a redeploy:
```
docker exec -u 0 mc chown -R 1000:1000 /data/world
docker restart mc
```

## Config / env

`ADMIN_PASSWORD`, `JWT_SECRET`, `MC_CONTAINER`, `MC_DATA_PATH`,
`PANEL_DATA_DIR`, `WORLD_NAME`, `SERVER_ADDRESS`, `RCON_HOST`, `RCON_PORT`,
`RCON_PASSWORD`, `BACKUP_SCHEDULE`, `BACKUP_RETENTION_DAYS`,
`GDRIVE_SERVICE_ACCOUNT_KEY`, `GDRIVE_FOLDER_ID`.

## Conventions

- Server is offline-mode (`ONLINE_MODE: FALSE`); resolve names via
  `usercache.json`, not just Mojang.
- Commit style: Conventional Commits, scoped `(panel)` / `(deploy)`.
- Never move directories across `/app/data` ↔ `/mc-data` with `rename`; use
  `moveDir`. Always `chown 1000:1000` world files the panel writes.
