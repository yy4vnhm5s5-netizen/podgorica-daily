# Deployment

## Status

The repository has a Railway Docker web deployment configuration. CEDIS, VIK Podgorica, and enabled live Events providers initialize missing caches in the background after a production Node.js web process starts. Durable Railway operation requires a Railway Volume and protected scheduled refresh triggers. The recommended production topology for the current Node.js file-cache architecture remains an Ubuntu VPS with Docker Compose, a persistent Docker volume, and Caddy on the host.

## Runtime contract

- Node.js 22 or later and pnpm 11.9.0 build the application with `pnpm run build`; the production process is `pnpm run start` or the standalone `node server.js` image entrypoint on port 3000.
- `NEXT_PUBLIC_SITE_URL` must be the public HTTPS origin in production. It enables absolute canonical and Open Graph URLs; do not include a path.
- `NEXT_PUBLIC_APP_ENV=production`, `NODE_ENV=production`, and `DEFAULT_CITY=podgorica` are required operational values.
- Events are public only from cache. Enable live event content with `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`; disabled mode safely shows no event data. Mock provider modes are rejected in production.
- `RUNTIME_DATA_DIR` is the shared root for file-backed provider caches. It defaults to `.runtime` locally. Without an explicit per-provider override, CEDIS resolves to `<RUNTIME_DATA_DIR>/cache/cedis-planned-outages.json`, VIK to `<RUNTIME_DATA_DIR>/cache/vikpg-water-alerts.json`, and MonteGigs Going Out to `<RUNTIME_DATA_DIR>/cache/montegigs-going-out.json`. Set `ENABLE_GOING_OUT=false` to keep the MonteGigs module hidden and prevent boot initialization.
- Each protected refresh route has an independent server-only secret of at least 32 characters: `CEDIS_REFRESH_SECRET`, `VIKPG_REFRESH_SECRET`, `FLIGHTS_REFRESH_SECRET`, `STANDARD_EVENTS_REFRESH_SECRET`, `CINEPLEXX_REFRESH_SECRET`, `GOING_OUT_REFRESH_SECRET`, and `ZPCG_RAILWAY_REFRESH_SECRET`. The legacy aggregate `CITY_ALERTS_REFRESH_SECRET` and `EVENT_REFRESH_SECRET` remain available only for their aggregate endpoints.
- The contact form delivers only through server-side SMTP. Set `CONTACT_EMAIL`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE`; provide `SMTP_USERNAME` and `SMTP_PASSWORD` together when the relay requires authentication. Do not expose any of these values to the browser. Without a complete SMTP configuration, the form returns a safe delivery-unavailable state and does not claim that an inquiry was sent.
- Weather may call Open-Meteo during server rendering and already has a safe failure state. It does not require an API key.

Every refresh secret is server-only. Do not commit a real `.env.production`, expose a refresh secret to the browser, or include one in logs.

## Cache and scheduling

The shared JSON cache creates missing parent directories and writes by temporary file plus atomic rename. The Compose `event-cache` volume is initialized for UID/GID 1001 and mounted at `/var/lib/podgorica-daily/cache` in both app and scheduler containers. Container recreation therefore does not erase cache snapshots.

The Compose scheduler uses `TZ=Europe/Podgorica` with Alpine `tzdata`, so schedules follow local civil time and daylight-saving changes. It refreshes Flights every 15 minutes; VIK every two hours; CEDIS every six hours; KIC, CNP, Glavni Grad, and Tourism together every three hours through one shared Events lock; MonteGigs every three hours; Cineplexx only at 05:00 and 17:00; and ŽPCG at 06:45 and 18:45. The scheduler and web runtime images include system Chromium for the Cineplexx public-page renderer. `EVENT_CACHE_FRESHNESS_MINUTES=240`, `GOING_OUT_CACHE_FRESHNESS_MINUTES=240`, `VIKPG_CACHE_FRESHNESS_MINUTES=150`, and `CEDIS_CACHE_FRESHNESS_MINUTES=420` are deliberately longer than their respective cadences. Flights remains 90 minutes, while Cineplexx and ŽPCG remain 780 minutes. A provider-specific atomic lock prevents overlap. Collector JSON is available through container logs; a retained previous cache exits successfully for CEDIS and VIK, while an unrecoverable refresh exits non-zero. Visitor requests never invoke collection.

The file-cache architecture is suitable for one VPS or another single persistent host. It is not safe for serverless or horizontally scaled deployments: ephemeral instances do not share `.runtime/cache`, atomic writes are local only, and scheduled collectors have no durable shared target. A durable storage adapter is required before considering managed/serverless hosting.

## Railway cache investigation

The repository supports Railway as a Docker-built web service: `railway.toml` selects the `Dockerfile` and defines a health check, while the final/default Docker stage is the Next.js `runner`. The image contains `public`, `.next/standalone`, and `.next/static`; it does not copy pre-populated provider snapshots.

The named `scheduler` Docker target contains source files and `scripts/scheduler-entrypoint.sh`, but `railway.toml` does not configure a separate Railway scheduler service or select that target. The repository also contains no Railway Volume declaration, mount path, or Railway-specific cache-path environment values. Repository configuration alone therefore cannot confirm a persistent Railway volume, a scheduler deployment, or shared storage between a deployed scheduler and web process.

Previously, CEDIS and VIK stayed unavailable because the Railway `runner` starts only the Next.js web process: it did not run either collector, no Railway scheduler or volume is declared in repository configuration, and no cache snapshot is bundled into the image. A relative cache path also depends on `/app` being writable by the non-root runner. The image now starts through a root-only runtime entrypoint, which creates `<RUNTIME_DATA_DIR>/cache` and the configured absolute `EVENT_CACHE_DIR`, assigns both to `nextjs:nodejs`, and then `exec`s the Next.js server as `nextjs`. Production startup starts a non-blocking initialization only when a CEDIS, VIK, enabled live Events, or enabled Podgorica Airport Flights cache is missing. Events initialization uses the existing all-provider refresh runner and persistent lock; it never runs in a visitor request and does not replace recurring scheduling.

Build-time ownership changes are insufficient for Railway: mounting a Volume at `/app/.runtime` replaces the image directory with the mounted filesystem, including its ownership metadata. The entrypoint therefore repairs ownership after the Volume mount is present. The application server never runs as root.

The background initialization makes a first deployment useful, but it is not a durable scheduler. Without a mounted Volume, a replacement or restart loses snapshots and triggers another controlled initialization. Railway Volumes are attached to individual services, so they must not be treated as a filesystem shared concurrently between independent web and scheduler services.

### Short-term Railway option: one service with a local volume

Run the web process and scheduled refresh logic in one Railway service, with one Railway Volume mounted at `/app/.runtime`. Set `RUNTIME_DATA_DIR=/app/.runtime`; do not set conflicting per-provider cache paths. CEDIS then writes `/app/.runtime/cache/cedis-planned-outages.json` and VIK writes `/app/.runtime/cache/vikpg-water-alerts.json`. The web process and refresh logic read and write that same service-local volume. Refresh locking prevents overlapping executions.

For initial deployment, startup logs report `cache found` or `cache missing`, then the provider refresh result and count. For subsequent Railway refreshes, use fixed protected endpoints on the Web service. They accept no request-supplied provider, URL, cache path, or configuration, return safe summaries only, and must never be called from public client code.

### Railway Cron trigger configuration

Do not set `cronSchedule` on the web service: Railway Cron starts a service’s command and expects that command to exit, whereas the web service must continue serving requests. Instead, create one small Railway Cron trigger service that only invokes the web service’s protected endpoint; it must not mount the web service’s Volume and it never reads or writes provider cache files.

1. Keep the web service on the repository `Dockerfile`, mount its Railway Volume at `/app/.runtime`, and set `RUNTIME_DATA_DIR=/app/.runtime` plus the server-only refresh secrets required by the jobs below.
2. Create a separate `curlimages/curl` trigger service for each fixed endpoint. A trigger service must not mount the Web service’s Volume; it only sends an authenticated request to the Web service, which owns the lock and atomic cache write.
3. Use the complete endpoint, schedule, and daylight-saving-time instructions in [DEPLOYMENT_RAILWAY.md](DEPLOYMENT_RAILWAY.md#recurring-refresh-jobs). Do not put a secret in a URL or repository configuration.

Expected endpoint responses are `200` when both latest refreshes succeed, `207` when any provider retained a previous valid snapshot, failed, or was locked while another provider completed, `409` when every provider is already running, and `500` when no provider completed or no secret is configured. Each response contains only `provider`, `attempted`, `success`, `alertCount`, `cacheStatus`, `retainedPreviousCache`, optional `errorCode`, and parser `warnings`; it excludes cache paths, alert payloads, HTML, and secrets. A retained cache is a partial refresh result, not a loss of the valid snapshot.

The endpoint logs one structured `city-alerts-refresh-started` record and one `city-alerts-refresh-completed` record with trigger, provider summaries, state, and `durationMs`. Collector output remains concise JSON. In Railway logs, verify the completed record has `state: "success"` or inspect a `partial` record for a provider with `retainedPreviousCache: true`; investigate `failure` rather than deleting a valid cache.

This option couples collection resource use and refresh failures to the web process, even though the short-lived Railway Cron trigger is a separate HTTP caller. A long-running or failing collector can contend with serving requests, and the web service cannot scale horizontally while relying on that local file cache. The Railway Volume is mandatory for cache persistence across restarts, but not for the one-time controlled initialization itself. This is appropriate only as a short-term single-service deployment measure.

### Long-term Railway option: separate services with shared durable storage

Run separate web and scheduler services only after replacing the local file-cache boundary with shared persistent storage, such as Postgres or an appropriate object-storage solution. The web service must read the same durable records written by the scheduler service; it must not rely on a local cache path or an assumed shared Railway Volume. Selecting and implementing that storage adapter requires a separate approved architecture change.

## Docker and proxy

`Dockerfile` has a multi-stage standalone application image that runs as non-root. The separate scheduler target retains source and package dependencies only for local collector execution. `docker-compose.yml` starts the app, scheduler, and one-shot cache-permission initializer; it does not run a collector during build.

Use [Caddyfile.example](../deploy/Caddyfile.example) as a host-level reverse-proxy template. Replace the placeholder email. Caddy terminates HTTPS, redirects HTTP, forwards standard proxy headers, compresses responses, caches immutable Next static assets, and adds safe baseline headers including HSTS. Next.js also emits `nosniff`, frame, referrer, and permissions-policy headers for deployments that do not use Caddy. A Content Security Policy is intentionally not configured until the production source/image policy is finalized; introduce it with report-only validation first. Caddy assumes it can reach port 3000 locally; do not expose port 3000 publicly once the proxy is enabled.

`GET /api/health` is liveness-only and returns `{ "status": "ok" }`. `GET /api/readiness` returns only event provider IDs and safe state/health labels. It returns 200 for ready or degraded operation and 503 only when all configured event providers are unavailable or the read fails. Neither endpoint contains file paths, diagnostics, events, HTML, or secrets.

## Ubuntu VPS runbook

1. Install Docker Engine, Docker Compose plugin, Git, and Caddy. Permit only SSH, HTTP, and HTTPS in the firewall; keep port 3000 private.
2. Create a non-root deploy user, clone the repository into `/srv/podgorica-daily`, and restrict `.env.production` to that user (`chmod 600`).
3. Copy `.env.example` to `.env.production`. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://<domain>`, `RUNTIME_DATA_DIR=/var/lib/podgorica-daily`, and the desired live flags. The default cache paths then resolve below the mounted `/var/lib/podgorica-daily/cache` directory.
4. From the repository, run `docker compose build` then `docker compose up -d`. Verify `docker compose ps` and `curl -fsS http://127.0.0.1:3000/api/health`.
5. Run each first collection manually only after confirming source permission and environment: `docker compose run --rm scheduler sh -c 'pnpm run collect:kic-events'` (repeat for the other three). Inspect `docker compose logs scheduler` and the cache volume contents.
6. Install the Caddy template as the active site configuration, replace placeholders, validate it with `caddy validate`, then reload Caddy. Verify HTTPS, the root dashboard and its `/podgorica` canonical URL, `/podgorica/dogadjaji`, and a city-prefixed event detail URL on a narrow phone viewport.
7. Roll back application code with the prior Git revision, rebuild, and `docker compose up -d`. Keep the cache volume: old snapshots remain readable. If a cache is lost, the Events UI safely reports no data until the next successful collection.

Back up the Compose file, Caddy configuration, `.env.production`, and the `event-cache` volume before host changes. Provider data is reproducible, so a daily compressed cache-volume backup is sufficient. Do not back up images, build artifacts, source HTML, or `node_modules`.

## Security checklist

- No credentials are committed; `.env.production` is ignored by convention and must be permission-restricted.
- Provider hosts are allow-listed in provider HTTP clients; browser and page requests use cache reads only.
- The public health endpoints expose no internal paths or event content.
- Run containers as the non-root UID 1001 after the one-shot cache initializer.
- Keep Caddy and Docker patched, enable automatic HTTPS only after DNS points to the VPS, and review provider terms before first live collection.
