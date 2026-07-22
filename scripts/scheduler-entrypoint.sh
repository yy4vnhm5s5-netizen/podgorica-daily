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

  # Podgorica Airport: every 15 minutes.
  case "$minute" in
    00|15|30|45) run_collector "podgorica-flights" "pnpm run collect:podgorica-flights" ;;
  esac

  # Each exact local-time case keeps collectors staggered and independently schedulable.
  case "$hour_minute" in
    # VIK: every two hours.
    00:10|02:10|04:10|06:10|08:10|10:10|12:10|14:10|16:10|18:10|20:10|22:10)
      run_collector "vikpg" "pnpm run collect:vikpg"
      ;;
    # CEDIS: every six hours.
    01:25|07:25|13:25|19:25) run_collector "cedis" "pnpm run collect:cedis" ;;
    # KIC, CNP, Glavni Grad, and Tourism: every three hours under one shared event lock.
    00:05|03:05|06:05|09:05|12:05|15:05|18:05|21:05)
      run_collector "standard-events" "pnpm run events:refresh-standard"
      ;;
    # MonteGigs: every three hours, offset from the standard events pass.
    01:00|04:00|07:00|10:00|13:00|16:00|19:00|22:00)
      run_collector "montegigs-going-out" "pnpm run collect:montegigs-going-out"
      ;;
    # Cineplexx: twice daily only; it is intentionally excluded from standard events.
    05:00|17:00) run_collector "cineplexx-events" "pnpm run collect:cineplexx-events" ;;
    # ŽPCG: twice daily, matching the current timetable policy.
    06:45|18:45) run_collector "zpcg-railway" "pnpm run collect:zpcg-railway" ;;
  esac

  sleep 20
done
