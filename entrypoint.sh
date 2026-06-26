#!/bin/sh
set -e

echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO - EMPTY)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Cannot start."
  exit 1
fi

echo "Running prisma db push..."
DATABASE_URL="$DATABASE_URL" npx prisma db push

echo "Starting NestJS..."
exec node dist/src/main.js
