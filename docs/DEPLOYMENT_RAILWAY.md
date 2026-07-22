# Railway deployment

## Architecture

Railway is a managed deployment option for the current single-city rollout. Create one Web service and attach one persistent volume at `/app/.runtime`. Set `RUNTIME_DATA_DIR=/app/.runtime`; the validated cache defaults then keep City Alerts, Events, Cineplexx, Podgorica Airport Flights, and ŽPCG snapshots below that mount. Do not create a second service that expects to share the same file-cache volume: Railway volumes attach to individual services and cannot be used as a concurrent shared filesystem.

The Web service serves cached application data only. Visitor requests never scrape providers. When enabled, production startup starts one non-blocking refresh only if a provider snapshot is absent or unusable. This boot initialization makes an empty mounted cache useful; it is not a periodic scheduler. Fixed protected endpoints invoke existing collectors on the Web service, which owns the mounted cache, atomic writes, and locks. Railway's cron configuration does not itself establish a confidential custom-header request contract, so use a trigger service that can send authenticated POST requests to the Web service.

## Dashboard runbook

1. Create or sign in to Railway, connect GitHub, and create a project from this repository. Select `main` as the initial production branch.
2. Create one service named `web`. Railway uses the repository `Dockerfile` through `railway.toml`; the dependency layer copies `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. This makes the explicit pnpm 11 build allowlist for `sharp` and `unrs-resolver` available during installation without enabling all dependency scripts. The final/default Docker target is `runner`, so Railway starts its standalone `CMD`, `node server.js`, with `HOSTNAME=0.0.0.0` and Railway's runtime `PORT`. Do not configure a Railway start-command override. Confirm health path `/api/health`.
3. Attach a persistent volume to `web` at `/app/.runtime`. Railway mounts volumes only at runtime, so do not try to create cache data during build. The runtime entrypoint creates and assigns `/app/.runtime/cache` to `nextjs:nodejs` after the mount is present, before starting the web server.
4. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `DEFAULT_CITY=podgorica`, and `RUNTIME_DATA_DIR=/app/.runtime`. Leave cache-path overrides unset unless a deliberate migration requires them. Set `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` only after the refresh mechanism is configured.
5. Generate Railway's public `*.up.railway.app` domain in Networking. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin and redeploy. Verify `/api/health`, `/`, `/podgorica`, `/podgorica/dogadjaji`, and a city-prefixed event detail URL.
6. Configure the fixed authenticated recurring jobs below. Do not put a secret in a URL. Interpret `200` as success, `207` as a retained previous cache or partial result, `401` as authentication failure, `409` as overlap, and `500` as configuration or unusable-refresh failure.
7. Inspect build/runtime logs, trigger the first refresh through the approved dashboard mechanism, and confirm data remains after a redeploy. Test the Events UI on a real phone.
8. Later add `example.com` in Railway Networking, publish Railway's DNS records at the registrar, wait for verification and managed HTTPS, update `NEXT_PUBLIC_SITE_URL`, redeploy, and verify canonical/Open Graph URLs. If using Cloudflare, begin with DNS-only mode for verification.

No SSH, host firewall, proxy, or certificate administration is required. Railway auto-deploys the selected GitHub branch; a failed release can be rolled back in its deployment dashboard. Check Railway Usage and configure alerts/limits if available. Railway pricing changes; migration remains portable through environment transfer, cache-volume transfer, scheduler replacement, and DNS change.

The `scheduler` Docker stage remains available only as the named `scheduler` target for a future separate scheduler deployment. It is deliberately not the final stage, because an unnamed Docker build exports the final stage and the Web service needs the `runner` image to serve `/api/health`.

## Recurring refresh jobs

Boot initialization creates missing snapshots once; it is deliberately not a periodic collector. Keep one Railway `web` service with the `/app/.runtime` Volume. Do not deploy the named Docker `scheduler` target as a second service against the same local file cache: Railway Volumes cannot be concurrently shared between independent services.

For each job below, create a small Railway Cron trigger service from `curlimages/curl`. It has no Volume and only calls the Web service. Give the trigger the matching `*_REFRESH_URL` and secret through Railway secret-variable references. The URL is the Web service’s internal or public HTTPS origin plus the listed path. Its start command is:

```sh
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'
```

The trigger never mounts or writes `/app/.runtime`; the Web service owns the mounted cache, lock, and atomic cache writes. The request body, query string, and URL cannot choose a provider or source URL.

| Job                                       | Railway cron (UTC)        | Endpoint                                | Web secret                       |
| ----------------------------------------- | ------------------------- | --------------------------------------- | -------------------------------- |
| Flights, every 15 minutes                 | `*/15 * * * *`            | `/api/internal/flights/refresh`         | `FLIGHTS_REFRESH_SECRET`         |
| VIK, every 30 minutes                     | `*/30 * * * *`            | `/api/internal/vikpg/refresh`           | `VIKPG_REFRESH_SECRET`           |
| CEDIS, every two hours                    | `25 */2 * * *`            | `/api/internal/cedis/refresh`           | `CEDIS_REFRESH_SECRET`           |
| Standard Events, every three hours        | `5 */3 * * *`             | `/api/internal/events/standard/refresh` | `STANDARD_EVENTS_REFRESH_SECRET` |
| Going Out, every three hours, staggered   | `35 */3 * * *`            | `/api/internal/going-out/refresh`       | `GOING_OUT_REFRESH_SECRET`       |
| Cineplexx, 05:00 and 17:00 Podgorica time | see daylight-saving table | `/api/internal/cineplexx/refresh`       | `CINEPLEXX_REFRESH_SECRET`       |
| ŽPCG, 06:45 and 18:45 Podgorica time      | see daylight-saving table | `/api/internal/zpcg/refresh`            | `ZPCG_RAILWAY_REFRESH_SECRET`    |

Configure each trigger with its own explicit variables and command:

```sh
# Flights: REFRESH_URL=https://<web>/api/internal/flights/refresh
# REFRESH_SECRET references FLIGHTS_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# VIK: REFRESH_URL=https://<web>/api/internal/vikpg/refresh
# REFRESH_SECRET references VIKPG_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# CEDIS: REFRESH_URL=https://<web>/api/internal/cedis/refresh
# REFRESH_SECRET references CEDIS_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Standard Events: /api/internal/events/standard/refresh + STANDARD_EVENTS_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Going Out: /api/internal/going-out/refresh + GOING_OUT_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Cineplexx: /api/internal/cineplexx/refresh + CINEPLEXX_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# ŽPCG: /api/internal/zpcg/refresh + ZPCG_RAILWAY_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'
```

Railway Cron schedules are UTC. A fixed UTC expression is not daylight-saving-safe for local-clock jobs. Either use a scheduler that supports `Europe/Podgorica`, or switch the two Railway expressions at each daylight-saving transition:

| Local-time job             | CET / UTC+1 (winter) | CEST / UTC+2 (summer) |
| -------------------------- | -------------------- | --------------------- |
| Cineplexx, 05:00 and 17:00 | `0 4,16 * * *`       | `0 3,15 * * *`        |
| ŽPCG, 06:45 and 18:45      | `45 5,17 * * *`      | `45 4,16 * * *`       |

`POST /api/internal/events/refresh` and `POST /api/internal/city-alerts/refresh` remain aggregate compatibility endpoints with their existing secrets. They are not the recommended recurring jobs because they cannot independently schedule Cineplexx, CEDIS, or VIK.

## Environment contract

`PORT` is Railway-provided. `NODE_ENV`, `NEXT_PUBLIC_APP_ENV`, `DEFAULT_CITY`, `ENABLE_EVENTS`, and `EVENT_PROVIDER_MODE` are safe configuration. `NEXT_PUBLIC_SITE_URL` is public and required for absolute production metadata. All refresh secrets, `CONTACT_EMAIL`, and `SMTP_*` values are server-only and must never be committed or exposed to the browser. `RUNTIME_DATA_DIR=/app/.runtime` is the production cache root; any explicit provider-cache override must also stay below that mount. Set `EVENT_CACHE_FRESHNESS_MINUTES=240`, `GOING_OUT_CACHE_FRESHNESS_MINUTES=240`, `VIKPG_CACHE_FRESHNESS_MINUTES=150`, and `CEDIS_CACHE_FRESHNESS_MINUTES=420`; retain Flights at 90 minutes and Cineplexx at 780 minutes. Weather currently has no API key. `.env.example` contains safe defaults only.

The app starts safely with an empty cache: Events show a safe empty/unavailable state, detail routes return not-found, and `/api/health` still returns 200. Public readiness is separate at `/api/readiness` and excludes paths, diagnostics, and event data.
