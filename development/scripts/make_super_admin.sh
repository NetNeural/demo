#!/bin/bash

# Update admin@netneural.com to super_admin role using Supabase REST API

SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyNjk1NSwiZXhwIjoyMDcwNjAyOTU1fQ.u9OK1PbjHLKMY8K1LM-bn8zYlRm-U5Zk1ef5NqQEhDQ"
SUPABASE_URL="https://bldojxpockljyivldxwf.supabase.co"

echo "Fetching user admin@netneural.com..."
USER_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/users?email=eq.admin@netneural.com&select=id,email,role,full_name" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

echo "Current user data:"
echo "$USER_RESPONSE" | jq '.'

USER_ID=$(echo "$USER_RESPONSE" | jq -r '.[0].id')

if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
  echo ""
  echo "Updating user $USER_ID to super_admin role..."
  
  UPDATE_RESPONSE=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/users?id=eq.${USER_ID}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{"role":"super_admin"}')
  
  echo "Update response:"
  echo "$UPDATE_RESPONSE" | jq '.'
  
  echo ""
  echo "✅ User admin@netneural.com has been updated to super_admin role!"
else
  echo "❌ User not found!"
fi
