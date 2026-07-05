#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS=${ATTEMPTS:-4}
for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "=== ATTEMPT $attempt ==="
  if pnpm exec tsx scripts/ops/affiliate/verify-pending-referral-flow.ts; then
    echo "=== SUCCESS ON ATTEMPT $attempt ==="
    exit 0
  fi
  sleep 2
 done

exit 1
