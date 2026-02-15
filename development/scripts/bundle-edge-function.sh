#!/bin/bash
# ============================================================================
# Bundle Edge Function with _shared Dependencies
# ============================================================================
# Creates a standalone version of an edge function with all dependencies
# bundled into a single index.ts file for manual dashboard upload
# ============================================================================

set -e

FUNCTION_NAME=$1
OUTPUT_DIR="./dist/bundled-functions"

if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: ./bundle-edge-function.sh <function-name>"
  echo "Example: ./bundle-edge-function.sh device-sync"
  exit 1
fi

FUNCTION_DIR="supabase/functions/$FUNCTION_NAME"

if [ ! -d "$FUNCTION_DIR" ]; then
  echo "Error: Function directory not found: $FUNCTION_DIR"
  exit 1
fi

echo "📦 Bundling $FUNCTION_NAME with _shared dependencies..."

# Create output directory
mkdir -p "$OUTPUT_DIR/$FUNCTION_NAME"

# Copy function files
cp -r "$FUNCTION_DIR"/* "$OUTPUT_DIR/$FUNCTION_NAME/" 2>/dev/null || true

# Copy _shared folder into function directory
if [ -d "supabase/functions/_shared" ]; then
  cp -r "supabase/functions/_shared" "$OUTPUT_DIR/$FUNCTION_NAME/"
  echo "✅ Copied _shared folder"
else
  echo "⚠️  Warning: _shared folder not found"
fi

echo ""
echo "✅ Bundle created at: $OUTPUT_DIR/$FUNCTION_NAME"
echo ""
echo "📤 To deploy manually:"
echo "1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions"
echo "2. Click '$FUNCTION_NAME' → 'Deploy new version'"
echo "3. Upload the entire folder: $OUTPUT_DIR/$FUNCTION_NAME"
echo ""
