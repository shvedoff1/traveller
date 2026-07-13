/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/test/**/*.e2e-spec.ts"],
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  // e2e suites share one Postgres/Redis; keep them sequential.
  maxWorkers: 1,
  testTimeout: 15000,
};
