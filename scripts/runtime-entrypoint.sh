#!/bin/sh
set -eu

runtime_data_dir="${RUNTIME_DATA_DIR:-/app/.runtime}"
event_cache_dir="${EVENT_CACHE_DIR:-${runtime_data_dir}/cache}"

case "$runtime_data_dir" in
  /*) ;;
  *)
    echo "RUNTIME_DATA_DIR must be an absolute path." >&2
    exit 64
    ;;
esac

if [ "$runtime_data_dir" = "/" ]; then
  echo "RUNTIME_DATA_DIR must not be the filesystem root." >&2
  exit 64
fi

case "$event_cache_dir" in
  /*) ;;
  *)
    echo "EVENT_CACHE_DIR must be an absolute path." >&2
    exit 64
    ;;
esac

if [ "$event_cache_dir" = "/" ]; then
  echo "EVENT_CACHE_DIR must not be the filesystem root." >&2
  exit 64
fi

echo "Preparing runtime directory: $runtime_data_dir"
mkdir -p "$runtime_data_dir/cache"
chown -R nextjs:nodejs "$runtime_data_dir"

echo "Preparing event cache directory: $event_cache_dir"
mkdir -p "$event_cache_dir"
chown -R nextjs:nodejs "$event_cache_dir"

echo "Starting application as nextjs."
exec su-exec nextjs:nodejs "$@"
