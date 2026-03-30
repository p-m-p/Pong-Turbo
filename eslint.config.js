import js from '@eslint/js';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  unicorn.configs['flat/recommended'],
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

  // ── Project-wide rule tuning ─────────────────────────────────────────────
  {
    rules: {
      // PascalCase is conventional for class files — allow both.
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],

      // null is used legitimately for optional adapter return values and DOM queries.
      'unicorn/no-null': 'off',

      // Browser-specific code intentionally uses window (e.g. AudioContext, matchMedia).
      'unicorn/prefer-global-this': 'off',

      // Index loops with splice() are intentional in hot paths (particles, collisions).
      'unicorn/no-for-loop': 'off',

      // Arrow functions in closures (orientation handlers) can't be moved to outer scope
      // without losing access to local variables.
      'unicorn/consistent-function-scoping': 'off',

      // Passing a named predicate function directly to .find() is intentional.
      'unicorn/no-array-callback-reference': 'off',

      // Abbreviations that are idiomatic in this codebase or established Web APIs.
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            // Web Components lifecycle (browser API naming — not our choice)
            connectedCallback: true,
            attributeChangedCallback: true,
            // Canvas / rendering
            ctx: true,
            dpr: true,
            px: true,
            // Game physics vectors
            vx: true,
            vy: true,
            dx: true,
            dy: true,
            cx: true,
            cy: true,
            // DOM shorthand conventional in this codebase
            el: true,
            // Loop variables
            i: true,
            j: true,
            k: true,
            // Single-letter geometry
            r: true,
            g: true,
            s: true,
            w: true,
            h: true,
            x: true,
            y: true,
            // Event handler param (extremely common shorthand)
            ev: true,
            // HTTP response (common in fetch patterns)
            res: true,
            // Audio nodes
            osc: true,
            src: true,
            // ArrayBuffer
            ab: true,
            // DOM element suffix — canvasEl, hudEl, scoreboardEl, statusEl etc.
            El: true,
            el: true,
            // prev suffix — rankPrev, prevLevel etc.
            Prev: true,
            prev: true,
            // str param in #esc() — renaming to string_ would be worse
            str: true,
            // Single-letter catch / error param
            e: true,
          },
        },
      ],
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

  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
