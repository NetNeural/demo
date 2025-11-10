#!/bin/bash
# Wrapper script for Edge Functions to run with PM2

cd "$(dirname "$0")"
exec npm run supabase:functions:serve
