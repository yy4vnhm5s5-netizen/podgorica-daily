# Railway deployment

## Architecture

Railway is a managed deployment option for the current multi-city rollout. Create one Web service and attach one persistent volume at `/app/.runtime`. Set `RUNTIME_DATA_DIR=/app/.runtime`; the validated cache defaults then keep city-scoped City Alerts and Going Out snapshots, together with Events, Cineplexx, Podgorica Airport Flights, and ŽPCG snapshots, below that mount. Do not create a second service that expects to share the same file-cache volume: Railway volumes attach to individual services and cannot be used as a concurrent shared filesystem.

The Web service serves cached application data only. Visitor requests never scrape providers. When enabled, production startup starts one non-blocking refresh only if a provider snapshot is absent or unusable. This boot initialization makes an empty mounted cache useful; it is not a periodic scheduler. Fixed protected endpoints invoke existing collectors on the Web service, which owns the mounted cache, atomic writes, and locks. Railway's cron configuration does not itself establish a confidential custom-header request contract, so use a trigger service that can send authenticated POST requests to the Web service.

## Dashboard runbook

1. Create or sign in to Railway, connect GitHub, and create a project from this repository. Select `main` as the initial production branch.
2. Create one service named `web`. Railway uses the repository `Dockerfile` through `railway.toml`; the dependency layer copies `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. This makes the explicit pnpm 11 build allowlist for `sharp` and `unrs-resolver` available during installation without enabling all dependency scripts. The final/default Docker target is `runner`, so Railway starts its standalone `CMD`, `node server.js`, with `HOSTNAME=0.0.0.0` and Railway's runtime `PORT`. Do not configure a Railway start-command override. Confirm health path `/api/health`.
3. Attach a persistent volume to `web` at `/app/.runtime`. Railway mounts volumes only at runtime, so do not try to create cache data during build. The runtime entrypoint creates and assigns `/app/.runtime/cache` to `nextjs:nodejs` after the mount is present, before starting the web server.
4. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `DEFAULT_CITY=podgorica`, and `RUNTIME_DATA_DIR=/app/.runtime`. Leave cache-path overrides unset unless a deliberate migration requires them. Set `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` only after the refresh mechanism is configured.
5. Generate Railway's public `*.up.railway.app` domain in Networking. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin and redeploy. Verify `/api/health`, `/`, `/podgorica`, `/podgorica/dogadjaji`, and a city-prefixed event detail URL.
6. Configure the fixed authenticated recurring jobs below. Do not put a secret in a URL. Interpret `200` as a full success, a partial result, or a retained previous snapshot; read the JSON body's `state` field to tell these apart. For Flights specifically, `200` also covers a fully unavailable provider whose failure was verified upstream (state `upstream-unavailable` — the collector reached the point of classifying the exact upstream error and confirmed it was not a local fault); every other provider still reports an undifferentiated `unavailable`/`failure` state as `500`, because a cache-write fault or an unexpected exception is not yet distinguished from a routine upstream outage for them — this is a known gap, not a guarantee that a `500` from those endpoints always means routine degradation. Interpret `400` as a malformed request (e.g. an unsupported query parameter), `401` as authentication failure, `409` as an overlapping refresh already in progress, and `500` as either that undifferentiated failure or a real endpoint problem (missing/misconfigured secret, an unhandled exception, or state `operational-failure` — a Flights-specific cache-write/programming fault confirmed _not_ to be upstream).
7. Inspect build/runtime logs, trigger the first refresh through the approved dashboard mechanism, and confirm data remains after a redeploy. Test the Events UI on a real phone.
8. Later add `example.com` in Railway Networking, publish Railway's DNS records at the registrar, wait for verification and managed HTTPS, update `NEXT_PUBLIC_SITE_URL`, redeploy, and verify canonical/Open Graph URLs. If using Cloudflare, begin with DNS-only mode for verification.

No SSH, host firewall, proxy, or certificate administration is required. Railway auto-deploys the selected GitHub branch; a failed release can be rolled back in its deployment dashboard. Check Railway Usage and configure alerts/limits if available. Railway pricing changes; migration remains portable through environment transfer, cache-volume transfer, scheduler replacement, and DNS change.

The `scheduler` Docker stage remains available only as the named `scheduler` target for a future separate scheduler deployment. It is deliberately not the final stage, because an unnamed Docker build exports the final stage and the Web service needs the `runner` image to serve `/api/health`.

## Recurring refresh jobs

Boot initialization creates missing snapshots once; it is deliberately not a periodic collector. Keep one Railway `web` service with the `/app/.runtime` Volume. Do not deploy the named Docker `scheduler` target as a second service against the same local file cache: Railway Volumes cannot be concurrently shared between independent services.

For each job below, create a small Railway Cron trigger service from `curlimages/curl`. It has no Volume and only calls the Web service. Give the trigger the matching `*_REFRESH_URL` and secret through Railway secret-variable references. The URL is the Web service’s internal or public HTTPS origin plus the listed path. Its start command is:

```sh
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'
```

`--write-out "\n"` appends a trailing newline after curl prints the response body, so consecutive cron runs never leave two JSON responses concatenated on one log line.

The trigger never mounts or writes `/app/.runtime`; the Web service owns the mounted cache, lock, and atomic cache writes. The request body, query string, and URL cannot choose a provider or source URL. The fixed CEDIS endpoint invokes the existing sequential collector for every active city with an electricity capability and approved CEDIS municipality mapping; its response includes one safe result per city.

| Job                                                            | Railway cron (UTC)        | Endpoint                                  | Web secret                         |
| -------------------------------------------------------------- | ------------------------- | ----------------------------------------- | ---------------------------------- |
| Flights, every 15 minutes                                      | `*/15 * * * *`            | `/api/internal/flights/refresh`           | `FLIGHTS_REFRESH_SECRET`           |
| VIK, every 30 minutes                                          | `*/30 * * * *`            | `/api/internal/vikpg/refresh`             | `VIKPG_REFRESH_SECRET`             |
| Vodovod Kotor, daily (retain the existing Railway schedule)    | existing daily cron       | `/api/internal/vodovod-kotor/refresh`     | `INTERNAL_REFRESH_TOKEN`           |
| ViK Ulcinj, every twelve hours                                 | `50 */12 * * *`           | `/api/internal/vik-ulcinj/refresh`        | `INTERNAL_REFRESH_TOKEN`           |
| CEDIS, every six hours for active supported cities             | `25 1,7,13,19 * * *`      | `/api/internal/cedis/refresh`             | `CEDIS_REFRESH_SECRET`             |
| Standard Events (CNP, Glavni Grad, Tourism), every three hours | `5 */3 * * *`             | `/api/internal/events/standard/refresh`   | `STANDARD_EVENTS_REFRESH_SECRET`   |
| Going Out, every three hours for all active supported cities   | `35 */3 * * *`            | `/api/internal/going-out/refresh`         | `GOING_OUT_REFRESH_SECRET`         |
| Sea Water Quality, daily for active supported cities           | `45 2 * * *`              | `/api/internal/sea-water-quality/refresh` | `SEA_WATER_QUALITY_REFRESH_SECRET` |
| Cineplexx, daily at 04:00 UTC                                  | `0 4 * * *`               | `/api/internal/cineplexx/refresh`         | `CINEPLEXX_REFRESH_SECRET`         |
| Fuel prices, daily at 03:40 UTC                                 | `40 3 * * *`              | `/api/internal/fuel/refresh`              | `INTERNAL_REFRESH_TOKEN`           |
| ŽPCG, 06:45 and 18:45 Podgorica time                           | see daylight-saving table | `/api/internal/zpcg/refresh`              | `ZPCG_RAILWAY_REFRESH_SECRET`      |

Configure each trigger with its own explicit variables and command:

```sh
# Flights: REFRESH_URL=https://<web>/api/internal/flights/refresh
# REFRESH_SECRET references FLIGHTS_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# VIK: REFRESH_URL=https://<web>/api/internal/vikpg/refresh
# REFRESH_SECRET references VIKPG_REFRESH_SECRET

# Vodovod Kotor:
# REFRESH_URL=https://<web>/api/internal/vodovod-kotor/refresh
# REFRESH_SECRET references INTERNAL_REFRESH_TOKEN
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# ViK Ulcinj:
# REFRESH_URL=https://<web>/api/internal/vik-ulcinj/refresh
# REFRESH_SECRET references INTERNAL_REFRESH_TOKEN
# One request refreshes Ulcinj only; it reads a single bounded page of the ViK Ulcinj WordPress
# REST API. Requires ENABLE_VIK_ULCINJ=true (the default) and the Ulcinj water capability.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# CEDIS: REFRESH_URL=https://<web>/api/internal/cedis/refresh
# REFRESH_SECRET references CEDIS_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Standard Events (CNP, Glavni Grad, Tourism for Podgorica and Tivat):
# /api/internal/events/standard/refresh + STANDARD_EVENTS_REFRESH_SECRET.
# KIC is intentionally excluded from the active refresh plan because its upstream TLS
# certificate is expired.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Going Out: /api/internal/going-out/refresh + GOING_OUT_REFRESH_SECRET.
# With no `city` query this endpoint sequentially refreshes every active city that has the
# `goingOut` capability and an approved MonteGigs source. New approved cities join this job through
# the shared city registry; do not create one cron per city. `?city=bar`, `?city=podgorica`,
# `?city=budva`, `?city=tivat`, and `?city=kotor` remain available only for targeted diagnostics or
# manual repair.
# After deploying and verifying this combined endpoint, remove legacy city-specific Going Out cron
# services (including any duplicate Budva trigger) so only this one Going Out cron remains.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Sea Water Quality: /api/internal/sea-water-quality/refresh +
# SEA_WATER_QUALITY_REFRESH_SECRET. One request sequentially refreshes every active, mapped city
# (Bar, Budva, Kotor, and Tivat today); do not create one cron per city.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Cineplexx: /api/internal/cineplexx/refresh + CINEPLEXX_REFRESH_SECRET, daily at 04:00 UTC.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# Fuel prices: /api/internal/fuel/refresh + INTERNAL_REFRESH_TOKEN, daily at 03:40 UTC.
# The ministry recalculates at most weekly, so a daily check is enough; the minute is offset from
# the other jobs so no two collectors contend for the same volume at once. One request reads the
# ministry tag listing plus at most twelve linked articles. If the newest article cannot be parsed
# into all four products the previous snapshot is retained and the response reports the warning
# rather than publishing partial prices.
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'

# ŽPCG: /api/internal/zpcg/refresh + ZPCG_RAILWAY_REFRESH_SECRET
sh -c 'curl --fail-with-body --silent --show-error --max-time 120 --write-out "\n" --request POST --header "Authorization: Bearer $REFRESH_SECRET" "$REFRESH_URL"'
```

Railway Cron schedules are UTC. A fixed UTC expression is not daylight-saving-safe for local-clock jobs. Either use a scheduler that supports `Europe/Podgorica`, or switch the ŽPCG expression at each daylight-saving transition:

| Local-time job        | CET / UTC+1 (winter) | CEST / UTC+2 (summer) |
| --------------------- | -------------------- | --------------------- |
| ŽPCG, 06:45 and 18:45 | `45 5,17 * * *`      | `45 4,16 * * *`       |

`POST /api/internal/events/refresh` and `POST /api/internal/city-alerts/refresh` remain aggregate compatibility endpoints with their existing secrets. The City Alerts endpoint sequentially invokes the same CEDIS, VIK Podgorica, eligible Vodovod Kotor, and eligible ViK Ulcinj collectors as the fixed endpoints, so no recurring Railway cron should target it while those provider-specific jobs are active. Keep it only for authenticated manual recovery. The Events aggregate endpoint is likewise not a recommended recurring job because Cineplexx retains its independent daily cadence.

## Environment contract

`PORT` is Railway-provided. `NODE_ENV`, `NEXT_PUBLIC_APP_ENV`, `DEFAULT_CITY`, `ENABLE_EVENTS`, `EVENT_PROVIDER_MODE`, `ENABLE_SEA_WATER_QUALITY=true`, and `ENABLE_WEATHER=true` are safe configuration. `NEXT_PUBLIC_SITE_URL` is public and required for absolute production metadata. All refresh secrets, `INTERNAL_REFRESH_TOKEN`, `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL`, and `RESEND_API_KEY` are server-only and must never be committed or exposed to the browser. `RUNTIME_DATA_DIR=/app/.runtime` is the production cache root; any explicit provider-cache override must also stay below that mount. Set `EVENT_CACHE_FRESHNESS_MINUTES=240`, `GOING_OUT_CACHE_FRESHNESS_MINUTES=240`, `VIKPG_CACHE_FRESHNESS_MINUTES=150`, `VODOVOD_KOTOR_CACHE_FRESHNESS_MINUTES=150`, `VIK_ULCINJ_CACHE_FRESHNESS_MINUTES=780`, `CEDIS_CACHE_FRESHNESS_MINUTES=420`, and `SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES=4320`; retain Flights at 90 minutes and Cineplexx at 780 minutes. Set `ENABLE_VODOVOD_KOTOR=true` with the shared internal refresh token configured before enabling the Vodovod Kotor cron. Fuel prices use the same shared `INTERNAL_REFRESH_TOKEN` and write `/app/.runtime/cache/fuel-prices.json`; `ENABLE_FUEL_PRICES` already defaults to `true`, so only the cron trigger service has to be created. Set `FUEL_CACHE_FRESHNESS_MINUTES=2160` (36 hours) so a snapshot only reads stale after two consecutive daily checks have been missed, not merely because prices did not change that week. The stored history accumulates and is never trimmed by a refresh — each run can only re-find the few articles the ministry still lists, so older calculations would be unrecoverable if dropped; the page displays the most recent twelve. ViK Ulcinj uses the same shared `INTERNAL_REFRESH_TOKEN` and writes `/app/.runtime/cache/vik-ulcinj-water-alerts.json`; `ENABLE_VIK_ULCINJ` already defaults to `true`, so only the cron trigger service has to be created. It runs on a twelve-hour cadence, and its freshness window is sized to match (780 minutes = 12h plus an hour of margin) so a snapshot only reads stale once a refresh has genuinely been missed. Sea Water Quality uses `SEA_WATER_QUALITY_REFRESH_SECRET`; its isolated current/history pairs are `/app/.runtime/cache/{bar,budva,kotor,tivat}-sea-water-quality.json` and `/app/.runtime/cache/{bar,budva,kotor,tivat}-sea-water-quality-history.json`. Weather uses `WEATHER_REFRESH_SECRET` for `POST /api/internal/weather/refresh`; one invocation refreshes every active city with the Weather capability and writes `/app/.runtime/cache/weather-podgorica.json` plus `weather-<cityId>.json` siblings. It has no API key and normal public requests never call Open-Meteo. No Railway Weather schedule is prescribed in this document. `.env.example` contains safe defaults only.

The app starts safely with an empty cache: Events show a safe empty/unavailable state, detail routes return not-found, and `/api/health` still returns 200. Public readiness is separate at `/api/readiness` and excludes paths, diagnostics, and event data.
