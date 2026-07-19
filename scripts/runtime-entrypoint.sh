#!/bin/sh
set -eu

runtime_data_dir="${RUNTIME_DATA_DIR:-/app/.runtime}"

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

echo "Preparing runtime directory: $runtime_data_dir"
mkdir -p "$runtime_data_dir/cache"
chown -R nextjs:nodejs "$runtime_data_dir"

echo "Starting application as nextjs."
exec su-exec nextjs:nodejs "$@"
