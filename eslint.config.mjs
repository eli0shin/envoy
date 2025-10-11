// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import esPlugin from 'eslint-plugin-es';
import importPlugin from 'eslint-plugin-import';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import eslintReact from '@eslint-react/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  eslintReact.configs['recommended-typescript'],
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        AbortSignal: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      es: esPlugin,
      import: importPlugin,
      'react-hooks': reactHooksPlugin,
      react: reactPlugin,
    },
    rules: {
      // Ban all console usage
      'no-console': 'error',

      // Enforce no explicit any types
      '@typescript-eslint/no-explicit-any': 'error',

      // Additional useful TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'off',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'error',

      // Ban dynamic imports and requires everywhere (they bypass mocking and cause testing issues)
      'es/no-dynamic-import': 'error',
      'import/no-dynamic-require': 'error',

      // React Hooks Rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // React Rules - manually added (not in recommended config)
      'react/no-array-index-key': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/no-unknown-property': 'off', // Let TypeScript handle prop validation
      'react/prop-types': 'off', // We use TypeScript for prop validation
      '@eslint-react/no-unnecessary-use-callback': 'error',
      '@eslint-react/no-unnecessary-use-memo': 'error',
      '@eslint-react/no-unnecessary-use-prefix': 'error',
      '@eslint-react/no-unnecessary-key': 'error',
      '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 'error',
      '@eslint-react/no-nested-component-definitions': 'error',
    },
  },
  {
    // Allow console usage in interactive tests
    files: ['**/*.interactive.test.ts', '**/interactive-tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console usage in test files for test assertions and debugging
    files: ['**/*.test.ts', '**/*.spec.ts', '**/vitest.setup.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'bin/**'],
  }
);
