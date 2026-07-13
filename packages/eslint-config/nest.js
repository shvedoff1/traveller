import globals from "globals";
import tseslint from "typescript-eslint";

import base from "./base.js";

/**
 * Preset for NestJS apps: base + node globals.
 *
 * `emitDecoratorMetadata` informs `consistent-type-imports` that classes
 * referenced in constructor signatures are runtime values (Nest DI reads
 * them from decorator metadata) — without it the rule would rewrite them
 * to type-only imports and break injection.
 */
export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node, ...globals.jest },
    parserOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  },
});
