import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../src/*', '../../src/*', '../../../src/*', 'src/*'],
            message: 'Core must not depend on UI modules.',
          },
          {
            group: ['../content/*', '../../content/*', '../../../content/*', 'content/*'],
            message: 'Core must not depend on scenario content packs.',
          },
          {
            group: ['../scenarios/*', '../../scenarios/*', '../../../scenarios/*', 'scenarios/*'],
            message: 'Core must not import scenario modules directly.',
          },
        ],
      }],
    },
  },
])
