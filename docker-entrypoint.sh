#!/bin/sh
set -e

# Fail fast with a message that actually says what's missing, instead of
# letting `prisma migrate deploy` hit an empty/malformed DATABASE_URL and
# print an internal Prisma connection error, or letting the app boot and
# fail confusingly the first time something touches the session cookie.
if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: variável de ambiente DATABASE_URL não definida." >&2
  exit 1
fi
if [ -z "$SESSION_SECRET" ]; then
  echo "ERRO: variável de ambiente SESSION_SECRET não definida (gere com: openssl rand -base64 32)." >&2
  exit 1
fi

# Idempotent — only applies migrations not yet recorded in
# _prisma_migrations, and no-ops if the schema is already current. Safe to
# run on every container start/restart, including multiple replicas
# starting at once (Prisma takes an advisory lock for this).
node node_modules/prisma/build/index.js migrate deploy

exec node server.js
