import globals from "globals";
import tseslint from "typescript-eslint";

import base from "./base.js";

/**
 * Preset for NestJS apps: base + node globals. Decorator-heavy code relies
 * on classes and parameter properties, so nothing extra to disable yet.
 */
export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node, ...globals.jest },
  },
});
