#!/bin/bash

# Script to find components that may need Sentry error handling
# Run from the development directory: ./scripts/audit-error-handling.sh

echo "🔍 Auditing Error Handling Coverage..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Finding fetch() calls..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -r "fetch(" src/app src/components --include="*.tsx" --include="*.ts" -n | \
  grep -v "node_modules" | \
  grep -v "test-sentry" | \
  head -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Finding axios calls..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -r "axios\." src/app src/components --include="*.tsx" --include="*.ts" -n | \
  grep -v "node_modules" | \
  head -10
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Finding console.error (potential missing Sentry)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -r "console\.error" src/app src/components --include="*.tsx" --include="*.ts" -n | \
  grep -v "node_modules" | \
  grep -v "test-sentry" | \
  head -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Components using handleApiError (good!)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -r "handleApiError" src/app src/components --include="*.tsx" --include="*.ts" -l | \
  grep -v "node_modules"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

total_fetch=$(grep -r "fetch(" src/app src/components --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules" | \
  grep -v "test-sentry" | \
  wc -l)

total_axios=$(grep -r "axios\." src/app src/components --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules" | \
  wc -l)

total_console_error=$(grep -r "console\.error" src/app src/components --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules" | \
  grep -v "test-sentry" | \
  wc -l)

total_handle_api_error=$(grep -r "handleApiError" src/app src/components --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules" | \
  wc -l)

echo "Total fetch() calls:        $total_fetch"
echo "Total axios calls:          $total_axios"
echo "Total console.error:        $total_console_error"
echo "Using handleApiError:       $total_handle_api_error"
echo ""

if [ "$total_handle_api_error" -lt 5 ]; then
  echo "⚠️  Low handleApiError usage! Consider updating API calls to use the utility."
else
  echo "✅ Good handleApiError coverage!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Review the files listed above"
echo "2. Update API calls to use handleApiError from @/lib/sentry-utils"
echo "3. Replace console.error with reportError for non-API errors"
echo "4. See SENTRY_GUIDE.md for examples"
echo "5. Use src/templates/page-template.tsx for new pages"
echo ""
