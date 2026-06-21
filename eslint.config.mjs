import { base, defineConfig, plugin } from "@heejun/eslint-config";
import { globalIgnores } from "eslint/config";
import globals from "globals";

// Root flat config used by lint-staged. Package-level lint commands keep their
// own eslint.config.mjs files, but the root pre-commit hook runs from here.
export default defineConfig(
  globalIgnores([
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "**/*.tsbuildinfo",
    "**/*.config.{js,mjs,cjs,ts}",
    "**/vendor/**",
    "desks/remote-devtools/**",
  ]),

  base({ files: ["**/*.{ts,tsx}"], tsconfigRootDir: import.meta.dirname }),

  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    plugins: { "@heejun": plugin },
    rules: {
      "@heejun/vitest-mock-import": "off",
      "@heejun/vitest-mock-import-original": "off",
      "@heejun/mock-response-naming": "off",
      "@heejun/no-js-interface-direct-access": "off",
    },
  },

  {
    files: ["platform/apps/api/**/*.ts", "platform/packages/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
);
