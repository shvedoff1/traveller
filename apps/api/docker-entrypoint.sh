#!/bin/sh
# Container entrypoint: apply pending migrations, then start the API.
# `migrate deploy` is safe to run concurrently/repeatedly (advisory lock).
set -eu

./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
exec node dist/main.js
