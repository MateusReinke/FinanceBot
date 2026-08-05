# syntax=docker/dockerfile:1

# Single Debian base across every stage on purpose: Prisma's query/schema
# engine binaries are downloaded for whatever OS `npm ci` runs on, and we
# need that to be the exact same OS the app runs on later. Switching to
# Alpine anywhere in this file would require pinning `binaryTargets` in
# schema.prisma to a musl target instead of relying on Prisma's own
# auto-detection.
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Full install (with devDependencies) — needed to typecheck/lint/build.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Separate production-only install for the runtime image. We can't reuse
# `deps` node_modules pruned down with --omit=dev after the fact, and we
# can't hand-pick just the `prisma`/`@prisma/*` folders either — the
# `prisma migrate deploy` command (run at container start, see
# docker-entrypoint.sh) pulls in @prisma/config, which drags in a wide,
# version-dependent tree (c12, chokidar, effect, ...) that lives outside
# node_modules/@prisma. A real `npm ci --omit=dev` is the only reliable way
# to get a complete, correctly hoisted production tree.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p .next/cache && chown -R node:node .next

# Standalone output, taken apart deliberately instead of copied as a whole
# directory — it also contains a `.env` file (whatever was present at build
# time), and we never want dev secrets baked into an image layer. Runtime
# config comes entirely from real environment variables (Coolify's panel).
COPY --from=builder --chown=node:node /app/.next/standalone/server.js ./server.js
COPY --from=builder --chown=node:node /app/.next/standalone/.next ./.next
COPY --from=builder --chown=node:node /app/.next/standalone/package.json ./package.json
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Complete production node_modules (see the prod-deps stage comment above),
# then the one piece prod-deps can't produce on its own: the actual
# generated client + query engine binary matching our schema, which only
# exists in the builder stage after `npx prisma generate` ran against it.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Coolify (and plain `docker run`) both read this. The actual listening
# port is controlled by the PORT env var above, which Coolify's panel can
# override per the deploy — Next's standalone server.js honors it natively.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
