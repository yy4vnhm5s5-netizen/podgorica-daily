#!/bin/sh
set -eu

# The scheduler image includes tzdata. Keep schedules in Podgorica civil time so
# daylight-saving changes do not require a fixed UTC offset in this process.
TZ="${TZ:-Europe/Podgorica}"
export TZ

run_collector() {
  name="$1"
  command="$2"

  lock_dir="/tmp/${name}.lock"
  mkdir "$lock_dir" 2>/dev/null || return 0
  trap 'rmdir "$lock_dir"' EXIT INT TERM

  started_at="$(date -Iseconds)"
  printf '%s scheduler collector-start provider=%s command=%s\n' "$started_at" "$name" "$command"
  if sh -c "$command"; then
    exit_code=0
  else
    exit_code=$?
  fi
  completed_at="$(date -Iseconds)"
  printf '%s scheduler collector-complete provider=%s exit_code=%s\n' "$completed_at" "$name" "$exit_code"

  rmdir "$lock_dir"
  trap - EXIT INT TERM
}

last_tick=""

while true; do
  tick="$(date +%Y-%m-%dT%H:%M%z)"
  if [ "$tick" = "$last_tick" ]; then
    sleep 20
    continue
  fi
  last_tick="$tick"

  hour_minute="$(date +%H:%M)"
  minute="$(date +%M)"

  # Airports of Montenegro flights: every 15 minutes for every configured active airport.
  case "$minute" in
    00|15|30|45) run_collector "airport-flights" "pnpm run collect:airport-flights" ;;
  esac

  # Parking availability: every ten minutes. The CLI's feature/capability guard returns without
  # fetching or writing while Parking is disabled, so this remains safe before rollout.
  case "$minute" in
    01|11|21|31|41|51) run_collector "parking-availability" "pnpm run collect:parking" ;;
  esac

  # Each exact local-time case keeps collectors staggered and independently schedulable.
  case "$hour_minute" in
    # VIK: every 30 minutes. Service notices can change within the same day, so this is more
    # useful than the older two-hour cadence while remaining staggered from the other collectors.
    00:10|00:40|01:10|01:40|02:10|02:40|03:10|03:40|04:10|04:40|05:10|05:40|06:10|06:40|07:10|07:40|08:10|08:40|09:10|09:40|10:10|10:40|11:10|11:40|12:10|12:40|13:10|13:40|14:10|14:40|15:10|15:40|16:10|16:40|17:10|17:40|18:10|18:40|19:10|19:40|20:10|20:40|21:10|21:40|22:10|22:40|23:10|23:40)
      run_collector "vikpg" "pnpm run collect:vikpg"
      ;;
    # Vodovod Kotor: daily, staggered from VIK. The CLI preserves its active-city and
    # water-capability guard before it can fetch or write a snapshot.
    00:20)
      run_collector "vodovod-kotor" "pnpm run collect:vodovod-kotor"
      ;;
    # ViK Ulcinj: every twelve hours, staggered from the other water collectors and matching the
    # cadence configured in production. VIK_ULCINJ_CACHE_FRESHNESS_MINUTES is sized to this
    # interval, so a snapshot only reads stale once a refresh has actually been missed.
    00:50|12:50)
      run_collector "vik-ulcinj" "pnpm run collect:vik-ulcinj"
      ;;
    # CEDIS: every six hours; the CLI sequentially refreshes each active allowlisted city.
    01:25|07:25|13:25|19:25) run_collector "cedis" "pnpm run collect:cedis" ;;
    # Sea Water Quality: once daily. One provider-wide run refreshes every active supported
    # coastal city sequentially and keeps a city-specific cache and lock for each one.
    02:45) run_collector "sea-water-quality" "pnpm run collect:sea-water-quality" ;;
    # CNP, Glavni Grad, and Tourism (Podgorica and Tivat): every three hours under one shared
    # event lock. KIC is intentionally excluded from the active provider registry because its
    # upstream TLS certificate is expired.
    00:05|03:05|06:05|09:05|12:05|15:05|18:05|21:05)
      run_collector "standard-events" "pnpm run events:refresh-standard"
      ;;
    # MonteGigs: every three hours, offset from the standard events pass. The CLI
    # sequentially refreshes every active city with an explicitly approved source.
    01:00|04:00|07:00|10:00|13:00|16:00|19:00|22:00)
      run_collector "montegigs-going-out" "pnpm run collect:montegigs-going-out"
      ;;
    # Cineplexx: daily only; it is intentionally excluded from standard events.
    05:00) run_collector "cineplexx-events" "pnpm run collect:cineplexx-events" ;;
    # ŽPCG: twice daily, matching the current timetable policy.
    06:45|18:45) run_collector "zpcg-railway" "pnpm run collect:zpcg-railway" ;;
  esac

  sleep 20
done
