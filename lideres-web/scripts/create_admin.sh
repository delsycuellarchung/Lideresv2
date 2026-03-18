#!/usr/bin/env bash
# Usage:
# 1) Ensure .env.local has NEXT_PUBLIC_APP_URL (or pass SITE as 4th arg)
# 2) Ensure PROVISION_ADMIN_SECRET is set in env or pass as 3rd arg
# 3) Run: ./scripts/create_admin.sh admin@example.com AdminPass123!

set -euo pipefail
EMAIL="$1"
PASSWORD="$2"
SECRET="${3:-${PROVISION_ADMIN_SECRET:-}}"
SITE="${4:-${NEXT_PUBLIC_APP_URL:-http://localhost:3000}}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 <email> <password> [secret] [site_url]"
  exit 1
fi

if [ -z "$SECRET" ]; then
  echo "PROVISION_ADMIN_SECRET not provided as arg or env var. Set PROVISION_ADMIN_SECRET in your environment or pass it as the 3rd argument."
  exit 1
fi

API_URL="$SITE/api/provision-admin"

echo "Creating admin user: $EMAIL at $API_URL"

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"$SECRET\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"role\":\"Admin\"}")

echo "Response:\n$RESPONSE"

# Simple success check
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "\nAdmin created successfully. You can now sign in with: $EMAIL"
else
  echo "\nCreation may have failed. Check the response above and Supabase logs."
fi
