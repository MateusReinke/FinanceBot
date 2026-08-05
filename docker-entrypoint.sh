#!/bin/sh
set -e

# Idempotent — only applies migrations not yet recorded in
# _prisma_migrations, and no-ops if the schema is already current. Safe to
# run on every container start/restart, including multiple replicas
# starting at once (Prisma takes an advisory lock for this).
node node_modules/prisma/build/index.js migrate deploy

exec node server.js
