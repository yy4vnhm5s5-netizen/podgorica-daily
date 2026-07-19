#!/bin/sh
set -eu

run_collector() {
  name="$1"
  command="$2"

  lock_dir="/tmp/${name}.lock"
  mkdir "$lock_dir" 2>/dev/null || return 0
  trap 'rmdir "$lock_dir"' EXIT INT TERM
  sh -c "$command" || true
  rmdir "$lock_dir"
  trap - EXIT INT TERM
}

while true; do
  minute="$(date +%M)"

  case "$minute" in
    07) run_collector "kic-events" "pnpm run collect:kic-events" ;;
    17) run_collector "cnp-events" "pnpm run collect:cnp-events" ;;
    27) run_collector "glavni-grad-events" "pnpm run collect:glavni-grad-events" ;;
    37) run_collector "tourism-events" "pnpm run collect:tourism-events" ;;
    47) run_collector "cedis" "pnpm run collect:cedis" ;;
    57) run_collector "vikpg" "pnpm run collect:vikpg" ;;
  esac

  sleep 60
done
