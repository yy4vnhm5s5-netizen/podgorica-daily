# Deployment

## Status

The repository has a Railway web deployment configuration, but its cache-backed data services are not yet configured for durable shared storage there. The recommended production topology for the current Node.js file-cache architecture is an Ubuntu VPS with Docker Compose, a persistent Docker volume, and Caddy on the host. This avoids adding a database or hosted scheduler before their contracts are approved.

## Runtime contract

- Node.js 22 or later and pnpm 11.9.0 build the application with `pnpm run build`; the production process is `pnpm run start` or the standalone `node server.js` image entrypoint on port 3000.
- `NEXT_PUBLIC_SITE_URL` must be the public HTTPS origin in production. It enables absolute canonical and Open Graph URLs; do not include a path.
- `NEXT_PUBLIC_APP_ENV=production`, `NODE_ENV=production`, and `DEFAULT_CITY=podgorica` are required operational values.
- Events are public only from cache. Enable live event content with `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`; disabled mode safely shows no event data. Mock provider modes are rejected in production.
- Set every event cache path to `/var/lib/podgorica-daily/cache/<provider>.json` in `.env.production`. Set `CEDIS_CACHE_PATH` and `AMSCG_CACHE_PATH` there as well so all collector and application cache files share the persistent volume.
- Weather may call Open-Meteo during server rendering and already has a safe failure state. It does not require an API key.

No currently configured variable is a secret. Do not commit a real `.env.production`; future credentials must remain server-only and outside logs.

## Cache and scheduling

The shared JSON cache creates missing parent directories and writes by temporary file plus atomic rename. The Compose `event-cache` volume is initialized for UID/GID 1001 and mounted at `/var/lib/podgorica-daily/cache` in both app and scheduler containers. Container recreation therefore does not erase cache snapshots.

The scheduler invokes collectors independently once per hour, staggered at minutes 07 (KIC), 17 (CNP), 27 (Glavni Grad), and 37 (Tourism). A per-collector atomic directory lock prevents overlap. Collector JSON is available through container logs; a retained previous cache exits successfully, while an unrecoverable refresh exits non-zero. Visitor requests never invoke collection.

The file-cache architecture is suitable for one VPS or another single persistent host. It is not safe for serverless or horizontally scaled deployments: ephemeral instances do not share `.runtime/cache`, atomic writes are local only, and scheduled collectors have no durable shared target. A durable storage adapter is required before considering managed/serverless hosting.

## Railway cache investigation

The repository currently supports Railway only as a Docker-built web service: `railway.toml` selects the `Dockerfile` and defines a health check, while the final/default Docker stage is the Next.js `runner`. That image contains `public`, `.next/standalone`, and `.next/static`; it does not copy a pre-populated `.runtime/cache` directory. Cache files are instead created lazily by collectors at the configured paths, which default to `.runtime/cache/*.json` relative to `/app`.

The named `scheduler` Docker target contains source files and `scripts/scheduler-entrypoint.sh`, but `railway.toml` does not configure a separate Railway scheduler service or select that target. The repository also contains no Railway Volume declaration, mount path, or Railway-specific cache-path environment values. Repository configuration alone therefore cannot confirm a persistent Railway volume, a scheduler deployment, or shared storage between a deployed scheduler and web process.

On the current configuration, a Railway web container can read only cache files present in its own writable container filesystem. Those files disappear when the container is replaced or restarted. Railway Volumes are attached to individual services, so they must not be treated as a filesystem shared concurrently between independent web and scheduler services. This explains cache-backed sections remaining unavailable even when the web health check succeeds.

### Short-term Railway option: one service with a local volume

Run the web process and scheduled refresh logic in one Railway service, with one Railway Volume mounted at an absolute runtime path such as `/app/.runtime`. Set `EVENT_CACHE_DIR`, every provider-specific event cache path, `CEDIS_CACHE_PATH`, and `AMSCG_CACHE_PATH` beneath that mount. The web process and refresh logic then read and write the same service-local volume. Refresh locking must continue to prevent overlapping collector executions.

This option couples scheduling, collection failures, resource use, and restarts to the web process. A long-running or failing collector can contend with serving requests, scheduler changes require web-service deployment changes, and the service cannot scale horizontally while relying on that local file cache. It is appropriate only as a short-term single-service deployment measure.

### Long-term Railway option: separate services with shared durable storage

Run separate web and scheduler services only after replacing the local file-cache boundary with shared persistent storage, such as Postgres or an appropriate object-storage solution. The web service must read the same durable records written by the scheduler service; it must not rely on a local cache path or an assumed shared Railway Volume. Selecting and implementing that storage adapter requires a separate approved architecture change.

## Docker and proxy

`Dockerfile` has a multi-stage standalone application image that runs as non-root. The separate scheduler target retains source and package dependencies only for local collector execution. `docker-compose.yml` starts the app, scheduler, and one-shot cache-permission initializer; it does not run a collector during build.

Use [Caddyfile.example](../deploy/Caddyfile.example) as a host-level reverse-proxy template. Replace `podgorica.example` and the placeholder email. Caddy terminates HTTPS, redirects HTTP, forwards standard proxy headers, compresses responses, caches immutable Next static assets, and adds safe baseline headers. It assumes Caddy can reach port 3000 locally; do not expose port 3000 publicly once the proxy is enabled.

`GET /api/health` is liveness-only and returns `{ "status": "ok" }`. `GET /api/readiness` returns only event provider IDs and safe state/health labels. It returns 200 for ready or degraded operation and 503 only when all configured event providers are unavailable or the read fails. Neither endpoint contains file paths, diagnostics, events, HTML, or secrets.

## Ubuntu VPS runbook

1. Install Docker Engine, Docker Compose plugin, Git, and Caddy. Permit only SSH, HTTP, and HTTPS in the firewall; keep port 3000 private.
2. Create a non-root deploy user, clone the repository into `/srv/podgorica-daily`, and restrict `.env.production` to that user (`chmod 600`).
3. Copy `.env.example` to `.env.production`. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://<domain>`, and the desired live flags. Configure all six cache paths below `/var/lib/podgorica-daily/cache`.
4. From the repository, run `docker compose build` then `docker compose up -d`. Verify `docker compose ps` and `curl -fsS http://127.0.0.1:3000/api/health`.
5. Run each first collection manually only after confirming source permission and environment: `docker compose run --rm scheduler sh -c 'pnpm run collect:kic-events'` (repeat for the other three). Inspect `docker compose logs scheduler` and the cache volume contents.
6. Install the Caddy template as the active site configuration, replace placeholders, validate it with `caddy validate`, then reload Caddy. Verify HTTPS, `/events` redirect, `/me/events`, `/en/events`, and an event detail URL on a narrow phone viewport.
7. Roll back application code with the prior Git revision, rebuild, and `docker compose up -d`. Keep the cache volume: old snapshots remain readable. If a cache is lost, the Events UI safely reports no data until the next successful collection.

Back up the Compose file, Caddy configuration, `.env.production`, and the `event-cache` volume before host changes. Provider data is reproducible, so a daily compressed cache-volume backup is sufficient. Do not back up images, build artifacts, source HTML, or `node_modules`.

## Security checklist

- No credentials are committed; `.env.production` is ignored by convention and must be permission-restricted.
- Provider hosts are allow-listed in provider HTTP clients; browser and page requests use cache reads only.
- The public health endpoints expose no internal paths or event content.
- Run containers as the non-root UID 1001 after the one-shot cache initializer.
- Keep Caddy and Docker patched, enable automatic HTTPS only after DNS points to the VPS, and review provider terms before first live collection.
