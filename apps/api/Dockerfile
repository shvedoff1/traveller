# syntax=docker/dockerfile:1
# Multi-stage build for the Traveller API (NestJS + Prisma).
#
# Build from the REPO ROOT (the pnpm workspace is the build context):
#   docker build -f apps/api/Dockerfile -t traveller-api .
#
# Behind a TLS-intercepting egress proxy, pass the proxy env plus its CA:
#   docker build -f apps/api/Dockerfile -t traveller-api \
#     --build-arg HTTPS_PROXY --build-arg NO_PROXY \
#     --build-arg EXTRA_CA_CERT="$(cat /path/to/proxy-ca.pem)" .
#
# The runtime image runs `prisma migrate deploy` on boot (entrypoint), then
# starts the compiled server. Configure via env: DATABASE_URL, REDIS_URL,
# JWT_SECRET, WEB_ORIGIN, API_URL, SMTP_HOST/PORT, TRUST_PROXY=true.

# ── Stage 1: install workspace deps ─────────────────────────────────────────
# Full (non-slim) image: ships OpenSSL for Prisma's engine tooling.
FROM node:22 AS deps
WORKDIR /app

# Optional corporate/proxy CA (PEM text) for the build's outbound TLS —
# NODE_EXTRA_CA_CERTS is additive, so an empty file is harmless. npm, pnpm
# and the Prisma engine download all honour it (corepack does not, which
# is why pnpm is installed through npm instead of `corepack enable`).
ARG EXTRA_CA_CERT=""
RUN printf '%s\n' "$EXTRA_CA_CERT" > /usr/local/share/extra-ca.pem \
 && if [ -n "$EXTRA_CA_CERT" ]; then \
      cp /usr/local/share/extra-ca.pem \
        /usr/local/share/ca-certificates/extra-ca.crt \
      && update-ca-certificates; \
    fi
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem

# Match the workspace's pinned packageManager version.
RUN npm install -g pnpm@10.33.0

# Manifests only — this layer caches until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter api...

# ── Stage 2: build shared + api, prune to a standalone bundle ───────────────
FROM deps AS build
COPY packages/tsconfig packages/tsconfig
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @traveller/shared build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api build \
 # Standalone production bundle (prod deps only, workspace deps packed in).
 && pnpm --filter api --legacy deploy --prod /out \
 # Regenerate the Prisma client inside the pruned node_modules.
 && cd /out && ./node_modules/.bin/prisma generate --schema prisma/schema.prisma \
 # Stash OpenSSL for the slim runtime (Prisma's engine links against it);
 # the glob keeps this arch-agnostic (x86_64 and arm64).
 && mkdir /ssl-libs \
 && cp /usr/lib/*-linux-gnu/libssl.so.3 /usr/lib/*-linux-gnu/libcrypto.so.3 /ssl-libs/

# ── Stage 3: minimal runtime ────────────────────────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

# Prisma's query engine needs libssl/libcrypto (not shipped in -slim).
COPY --from=build /ssl-libs/ /usr/lib/
COPY --from=build --chown=node:node /out .
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
