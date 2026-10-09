#!/usr/bin/env bash
set -euo pipefail
runtime_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
exec docker compose --env-file "$runtime_dir/.env" -f "$runtime_dir/compose.yaml" "$@"
