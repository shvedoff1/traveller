/**
 * Jest env defaults — lets `pnpm exec jest` work directly. The run-tests.sh
 * entrypoint (and CI) export these before Jest starts; anything already set
 * wins. Tests always target the dedicated *_test database.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://traveller:traveller@localhost:5432/traveller_test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_SECRET ??= "local-test-secret";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
