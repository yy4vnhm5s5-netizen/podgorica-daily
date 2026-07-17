# Railway deployment

## Architecture

Railway is the first managed deployment target for this generic multi-city platform. Podgorica is the first active rollout, not an infrastructure boundary. Create one Web service, attach one persistent volume at `/data/events`, and configure all event cache-path variables below that directory. Do not create a second service that expects to share the same file-cache volume: Railway volumes attach to services and volume-backed deployments are intentionally serialized to avoid corruption.

The Web service serves cached application data only. Visitor requests never scrape providers. Refreshes use `POST /api/internal/events/refresh` with `Authorization: Bearer <EVENT_REFRESH_SECRET>`, acquire a persistent lock, and recover locks older than 30 minutes. Railway's cron configuration does not itself establish a confidential custom-header request contract, so use an operator-selected scheduler that can send an authenticated POST to the Railway-generated domain. The target schedule is `17 */3 * * *` in UTC (approximately 18:17/21:17 CET and 19:17/22:17 CEST, plus every three hours). Railway dashboard wording may change.

## Dashboard runbook

1. Create or sign in to Railway, connect GitHub, and create a project from this repository. Select `main` as the initial production branch.
2. Create one service named `web`. Railway uses the repository `Dockerfile` through `railway.toml`; the dependency layer copies `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before `pnpm install --frozen-lockfile`. This makes the explicit pnpm 11 build allowlist for `sharp` and `unrs-resolver` available during installation without enabling all dependency scripts. Do not configure a Railway start-command override: the standalone runner image uses its Docker `CMD`, `node server.js`, with `HOSTNAME=0.0.0.0` and Railway's runtime `PORT`. Confirm health path `/api/health`.
3. Attach a persistent volume to `web` at `/data/events`. Railway mounts volumes only at runtime, so do not try to create cache data during build.
4. Set `NODE_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, `DEFAULT_CITY=podgorica`, `EVENT_CACHE_DIR=/data/events`, and all provider cache paths below `/data/events`. Set `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` only after the refresh mechanism is configured.
5. Generate Railway's public `*.up.railway.app` domain in Networking. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin and redeploy. Verify `/api/health`, `/events`, `/me/events`, `/en/events`, and an event detail URL.
6. Configure an authenticated external scheduler for `17 */3 * * *` UTC. It must call `POST /api/internal/events/refresh` with `Authorization: Bearer <EVENT_REFRESH_SECRET>` and a short timeout; do not put the secret in a URL. Interpret `200` as success, `207` as partial completion, `401` as authentication failure, `409` as overlap, and `500` as configuration/internal failure.
7. Inspect build/runtime logs, trigger the first refresh through the approved dashboard mechanism, and confirm data remains after a redeploy. Test the Events UI on a real phone.
8. Later add `example.com` in Railway Networking, publish Railway's DNS records at the registrar, wait for verification and managed HTTPS, update `NEXT_PUBLIC_SITE_URL`, redeploy, and verify canonical/Open Graph URLs. If using Cloudflare, begin with DNS-only mode for verification.

No SSH, host firewall, proxy, or certificate administration is required. Railway auto-deploys the selected GitHub branch; a failed release can be rolled back in its deployment dashboard. Check Railway Usage and configure alerts/limits if available. Railway pricing changes; migration remains portable through environment transfer, cache-volume transfer, scheduler replacement, and DNS change.

## Environment contract

`PORT` is Railway-provided. `NODE_ENV`, `NEXT_PUBLIC_APP_ENV`, `DEFAULT_CITY`, `ENABLE_EVENTS`, and `EVENT_PROVIDER_MODE` are safe configuration. `NEXT_PUBLIC_SITE_URL` is public and required for absolute production metadata. `EVENT_REFRESH_SECRET` is a server-only secret and must never be committed or exposed to the browser. `EVENT_CACHE_DIR` and provider cache paths must be mounted-volume paths in production. Weather currently has no API key. `.env.example` contains safe defaults only.

The app starts safely with an empty cache: Events show a safe empty/unavailable state, detail routes return not-found, and `/api/health` still returns 200. Public readiness is separate at `/api/readiness` and excludes paths, diagnostics, and event data.
