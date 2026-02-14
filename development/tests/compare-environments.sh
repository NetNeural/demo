#!/bin/bash
# Simple comparison script using curl
# Compares production vs staging feature availability

PROD_URL="https://demo.netneural.ai"
STAGE_URL="https://demo-stage.netneural.ai"

echo "🔍 Environment Feature Comparison"
echo "=" | awk '{for(i=1;i<=80;i++)printf"=";printf"\n"}'
echo ""
echo "Production: $PROD_URL"
echo "Staging:    $STAGE_URL"
echo ""

# Test pages (non-authenticated)
PAGES=(
  "/"
  "/auth/login"
)

# Authenticated pages (will check availability but expect redirects)
AUTH_PAGES=(
  "/dashboard"
  "/dashboard/devices"
  "/dashboard/alerts"
  "/dashboard/analytics"
  "/dashboard/organizations"
  "/dashboard/settings"
  "/dashboard/users"
  "/dashboard/integrations"
  "/dashboard/alert-rules"
)

check_page() {
  local url=$1
  local page=$2
  local full_url="${url}${page}"
  
  # Follow redirects and get final status
  status=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "$full_url" 2>/dev/null || echo "000")
  echo "$status"
}

echo "📋 Public Pages (should return 200)"
echo "-" | awk '{for(i=1;i<=80;i++)printf"-";printf"\n"}'
for page in "${PAGES[@]}"; do
  prod_status=$(check_page "$PROD_URL" "$page")
  stage_status=$(check_page "$STAGE_URL" "$page")
  
  if [ "$prod_status" = "$stage_status" ]; then
    icon="✅"
  else
    icon="❌"
  fi
  
  printf "%-30s | Prod: %3s | Stage: %3s | %s\n" "$page" "$prod_status" "$stage_status" "$icon"
done

echo ""
echo "📋 Protected Pages (checking availability - redirects expected)"
echo "-" | awk '{for(i=1;i<=80;i++)printf"-";printf"\n"}'
for page in "${AUTH_PAGES[@]}"; do
  prod_status=$(check_page "$PROD_URL" "$page")
  stage_status=$(check_page "$STAGE_URL" "$page")
  
  # For authenticated pages, both should behave the same (redirect or show page)
  if [ "$prod_status" = "$stage_status" ]; then
    icon="✅"
  else
    icon="⚠️"
  fi
  
  printf "%-30s | Prod: %3s | Stage: %3s | %s\n" "$page" "$prod_status" "$stage_status" "$icon"
done

echo ""
echo "📊 Summary"
echo "=" | awk '{for(i=1;i<=80;i++)printf"=";printf"\n"}'
echo "✅ = Matching behavior"
echo "❌ = Different status codes"
echo "⚠️  = Different behavior (may need investigation)"
echo ""
echo "Note: This script only checks HTTP status codes."
echo "Feature comparison requires authenticated testing."
