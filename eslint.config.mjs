// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import esPlugin from "eslint-plugin-es";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        AbortSignal: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      es: esPlugin,
      import: importPlugin,
    },
    rules: {
      // Enforce no explicit any types
      "@typescript-eslint/no-explicit-any": "error",

      // Additional useful TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "off",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",

      // Ban dynamic imports and requires everywhere (they bypass mocking and cause testing issues)
      "es/no-dynamic-import": "error",
      "import/no-dynamic-require": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
);
