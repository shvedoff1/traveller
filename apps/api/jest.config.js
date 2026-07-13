/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/test/**/*.e2e-spec.ts"],
};
