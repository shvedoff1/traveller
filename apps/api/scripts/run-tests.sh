#!/bin/sh
# Test entrypoint for apps/api — used locally and in CI.
#
# Applies Prisma migrations to the test database before running Jest, so a
# fresh CI Postgres (or a fresh local traveller_test DB) is always in shape.
# Env vars respect anything already exported (CI sets them); local runs fall
# back to the docker-compose defaults with the dedicated *_test database.
set -eu

export DATABASE_URL="${DATABASE_URL:-postgresql://traveller:traveller@localhost:5432/traveller_test}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET="${JWT_SECRET:-local-test-secret}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
export NODE_ENV=test

pnpm exec prisma migrate deploy
pnpm exec jest --runInBand
