#!/usr/bin/env bash
set -euo pipefail
export DATABASE_URL='postgresql://postgres:LqiUWMAkAViKoQpcFpkGYdKlJrrPVuRn@tramway.proxy.rlwy.net:36671/railway'
export DIRECT_URL="$DATABASE_URL"

attempt=1
while [ $attempt -le 4 ]; do
  echo "=== ATTEMPT $attempt ==="
  if pnpm exec tsx .tmp/verify-pending-referral-flow.ts; then
    echo "=== SUCCESS ON ATTEMPT $attempt ==="
    exit 0
  fi
  echo "=== FAILED ATTEMPT $attempt ==="
  attempt=$((attempt+1))
  sleep 5
done

exit 1
