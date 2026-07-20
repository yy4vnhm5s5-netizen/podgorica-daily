#!/bin/sh
set -eu

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

while true; do
  minute="$(date +%M)"
  hour="$(date +%H)"

  case "$minute" in
    05) run_collector "cineplexx-events" "pnpm run collect:cineplexx-events" ;;
    07) run_collector "kic-events" "pnpm run collect:kic-events" ;;
    17)
      run_collector "cnp-events" "pnpm run collect:cnp-events"
      run_collector "cineplexx-events" "pnpm run collect:cineplexx-events"
      ;;
    27) run_collector "glavni-grad-events" "pnpm run collect:glavni-grad-events" ;;
    37) run_collector "tourism-events" "pnpm run collect:tourism-events" ;;
    00|30)
      run_collector "cedis" "pnpm run collect:cedis"
      run_collector "vikpg" "pnpm run collect:vikpg"
      ;;
  esac

  case "$hour:$minute" in
    06:45|18:45) run_collector "zpcg-railway" "pnpm run collect:zpcg-railway" ;;
  esac

  sleep 60
done
