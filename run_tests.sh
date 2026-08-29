#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/playwright"
exec npx playwright test "$@"
