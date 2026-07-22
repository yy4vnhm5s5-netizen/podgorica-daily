# Railway deployment

## Architecture

Railway is a managed deployment option for the current single-city rollout. Create one Web service and attach one persistent volume at `/app/.runtime`. Set `RUNTIME_DATA_DIR=/app/.runtime`; the validated cache defaults then keep City Alerts, Events, Cineplexx, Podgorica Airport Flights, and ŽPCG snapshots below that mount. Do not create a second service that expects to share the same file-cache volume: Railway volumes attach to individual services and cannot be used as a concurrent shared filesystem.

The Web service serves cached application data only. Visitor requests never scrape providers. When `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`, production startup starts one non-blocking refresh only if one or more provider snapshots are absent or unusable. It uses the same lock and refresh runner as scheduled refreshes, so it cannot overlap an authenticated refresh. This boot initialization makes an empty mounted cache useful; it is not a periodic scheduler. Refreshes use `POST /api/internal/events/refresh` with `Authorization: Bearer <EVENT_REFRESH_SECRET>`, acquire a persistent lock, and recover locks older than 30 minutes. The refresh runner also includes the Cineplexx Podgorica browser-rendered provider. Railway's cron configuration does not itself establish a confidential custom-header request contract, so use an operator-selected scheduler that can send an authenticated POST to the Railway-generated domain. Keep the main Event cadence as an operator decision; schedule Cineplexx around 05:00 and 17:00 Europe/Podgorica, accounting for Railway Cron's UTC schedule and daylight-saving changes. Railway dashboard wording may change.

## Dashboard runbook

1. Create or sign in to Railway, connect GitHub, and create a project from this repository. Select `main` as the initial production branch.
2. Create one service named `web`. Railway uses the repository `Dockerfile` through `railway.toml`; the dependency layer copies `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. This makes the explicit pnpm 11 build allowlist for `sharp` and `unrs-resolver` available during installation without enabling all dependency scripts. The final/default Docker target is `runner`, so Railway starts its standalone `CMD`, `node server.js`, with `HOSTNAME=0.0.0.0` and Railway's runtime `PORT`. Do not configure a Railway start-command override. Confirm health path `/api/health`.
3. Attach a persistent volume to `web` at `/app/.runtime`. Railway mounts volumes only at runtime, so do not try to create cache data during build. The runtime entrypoint creates and assigns `/app/.runtime/cache` to `nextjs:nodejs` after the mount is present, before starting the web server.
4. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `DEFAULT_CITY=podgorica`, and `RUNTIME_DATA_DIR=/app/.runtime`. Leave cache-path overrides unset unless a deliberate migration requires them. Set `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` only after the refresh mechanism is configured.
5. Generate Railway's public `*.up.railway.app` domain in Networking. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin and redeploy. Verify `/api/health`, `/events`, `/me/events`, the permanent `/en/events` redirect, and an event detail URL.
6. Configure an authenticated external scheduler that calls `POST /api/internal/events/refresh` with `Authorization: Bearer <EVENT_REFRESH_SECRET>` and a short timeout; do not put the secret in a URL. Include runs around 05:00 and 17:00 Europe/Podgorica for Cineplexx, translating the schedule to UTC and reviewing it at daylight-saving changes. Interpret `200` as success, `207` as partial completion, `401` as authentication failure, `409` as overlap, and `500` as configuration/internal failure.
7. Inspect build/runtime logs, trigger the first refresh through the approved dashboard mechanism, and confirm data remains after a redeploy. Test the Events UI on a real phone.
8. Later add `example.com` in Railway Networking, publish Railway's DNS records at the registrar, wait for verification and managed HTTPS, update `NEXT_PUBLIC_SITE_URL`, redeploy, and verify canonical/Open Graph URLs. If using Cloudflare, begin with DNS-only mode for verification.

No SSH, host firewall, proxy, or certificate administration is required. Railway auto-deploys the selected GitHub branch; a failed release can be rolled back in its deployment dashboard. Check Railway Usage and configure alerts/limits if available. Railway pricing changes; migration remains portable through environment transfer, cache-volume transfer, scheduler replacement, and DNS change.

The `scheduler` Docker stage remains available only as the named `scheduler` target for a future separate scheduler deployment. It is deliberately not the final stage, because an unnamed Docker build exports the final stage and the Web service needs the `runner` image to serve `/api/health`.

## Recurring Events refresh

Boot initialization creates missing snapshots once; it is deliberately not a periodic collector. Keep one Railway `web` service with the `/app/.runtime` Volume. Do not deploy the named Docker `scheduler` target as a second service against the same local file cache: Railway Volumes cannot be concurrently shared between independent services.

For the current file-cache topology, create a small Railway Cron trigger service that has no Volume and only calls the Web service. Use `curlimages/curl`, schedule it for `17 */3 * * *` UTC, and set its start command to:

```sh
sh -c 'curl --fail --silent --show-error --max-time 120 -X POST -H "Authorization: Bearer ${EVENT_REFRESH_SECRET}" "${EVENT_REFRESH_URL}"'
```

Set `EVENT_REFRESH_URL` to the Web service's internal or public HTTPS URL followed by `/api/internal/events/refresh`, and reference the same server-only `EVENT_REFRESH_SECRET` from the Web service. The trigger never mounts or writes `/app/.runtime`; the Web service owns the mounted cache, lock, and atomic cache writes. A `409` response means another boot or scheduled refresh owns the lock and must be investigated or retried by the scheduler policy. Configure a separate authenticated trigger for `/api/internal/city-alerts/refresh` with `CITY_ALERTS_REFRESH_SECRET` when CEDIS and VIK periodic refreshes are enabled.

## Environment contract

`PORT` is Railway-provided. `NODE_ENV`, `NEXT_PUBLIC_APP_ENV`, `DEFAULT_CITY`, `ENABLE_EVENTS`, and `EVENT_PROVIDER_MODE` are safe configuration. `NEXT_PUBLIC_SITE_URL` is public and required for absolute production metadata. `EVENT_REFRESH_SECRET`, `CITY_ALERTS_REFRESH_SECRET`, `CONTACT_EMAIL`, and all `SMTP_*` values are server-only and must never be committed or exposed to the browser. `RUNTIME_DATA_DIR=/app/.runtime` is the production cache root; any explicit provider-cache override must also stay below that mount. Keep `CINEPLEXX_CACHE_FRESHNESS_MINUTES=780` unless the twice-daily collection policy changes. Weather currently has no API key. `.env.example` contains safe defaults only.

The app starts safely with an empty cache: Events show a safe empty/unavailable state, detail routes return not-found, and `/api/health` still returns 200. Public readiness is separate at `/api/readiness` and excludes paths, diagnostics, and event data.
