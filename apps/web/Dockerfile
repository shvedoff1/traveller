# syntax=docker/dockerfile:1
# Multi-stage build for the Traveller web app (Next.js 15 standalone).
#
# Build from the REPO ROOT (the pnpm workspace is the build context):
#   docker build -f apps/web/Dockerfile -t traveller-web .
#
# Behind a TLS-intercepting egress proxy, pass the proxy env plus its CA:
#   docker build -f apps/web/Dockerfile -t traveller-web \
#     --build-arg HTTPS_PROXY --build-arg NO_PROXY \
#     --build-arg EXTRA_CA_CERT="$(cat /path/to/proxy-ca.pem)" .
#
# NEXT_PUBLIC_* values are inlined at build time — pass NEXT_PUBLIC_SITE_URL
# as a build-arg. Server-only runtime env (API_INTERNAL_URL for SSR) is read
# from the container environment at start, not baked in here.

# ── Stage 1: install workspace deps ─────────────────────────────────────────
FROM node:22 AS deps
WORKDIR /app

# Optional corporate/proxy CA (PEM text) for the build's outbound TLS —
# NODE_EXTRA_CA_CERTS is additive, so an empty file is harmless.
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
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter web...

# ── Stage 2: build shared + web (Next standalone output) ────────────────────
FROM deps AS build

# Public site origin baked into the client bundle (metadataBase, share links).
ARG NEXT_PUBLIC_SITE_URL="https://traveller.shvedov.tech"
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Client talks same-origin through Caddy; keep the built-in "/api" default.
ENV NEXT_TELEMETRY_DISABLED=1

COPY packages/tsconfig packages/tsconfig
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @traveller/shared build \
 && pnpm --filter web build

# ── Stage 3: minimal runtime ────────────────────────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds this host/port; 0.0.0.0 so Caddy can reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

# Next standalone output (tracing root pinned to the repo root): a self-
# contained server with only the traced node_modules. Static assets and
# public/ are copied alongside (not included in standalone by design).
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
