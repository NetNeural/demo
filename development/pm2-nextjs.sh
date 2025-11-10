#!/bin/bash
# Wrapper script for Next.js to run with PM2

cd "$(dirname "$0")"
exec npm run dev
