import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,

  // ── Browser source files ─────────────────────────────────────────────────
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },

  // ── Test / config files (Node environment) ───────────────────────────────
  {
    files: ['tests/**/*.js', '*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },

  // ── Project-wide rules ───────────────────────────────────────────────────
  {
    rules: {
      // Correctness
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],

      // Modern JS
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'no-duplicate-imports': 'error',

      // Debug hygiene
      'no-console': 'warn',
    },
  },

  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
