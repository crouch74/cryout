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
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/adapters/compat/**/*.ts', 'src/engine/index.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@app/*', '@features/*', '@game/*', '@ui/*', '@devtools/*', '@scenarios/*'],
            message: 'Engine modules must remain scenario-agnostic and UI-free.',
          },
          {
            group: ['../app/*', '../../app/*', '../../../app/*', '../features/*', '../../features/*', '../../../features/*', '../game/*', '../../game/*', '../../../game/*', '../ui/*', '../../ui/*', '../../../ui/*', '../devtools/*', '../../devtools/*', '../../../devtools/*', '../scenarios/*', '../../scenarios/*', '../../../scenarios/*'],
            message: 'Engine modules must not import app, feature, game, UI, devtools, or scenario modules.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/scenarios/**/*.ts'],
    ignores: ['src/scenarios/testing/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@app/*', '@features/*', '@game/*', '@ui/*', '@devtools/*'],
            message: 'Scenario modules must not depend on product UI or workflow layers.',
          },
          {
            group: ['../app/*', '../../app/*', '../../../app/*', '../features/*', '../../features/*', '../../../features/*', '../game/*', '../../game/*', '../../../game/*', '../ui/*', '../../ui/*', '../../../ui/*', '../devtools/*', '../../devtools/*', '../../../devtools/*'],
            message: 'Scenario modules must stay isolated from app, feature, game, UI, and devtools folders.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/game/**/*.ts', 'src/game/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@features/*'],
            message: 'Game runtime UI must not import feature modules directly.',
          },
          {
            group: ['../features/*', '../../features/*', '../../../features/*'],
            message: 'Game runtime UI must receive feature state through props and adapters.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/features/**/*.ts', 'src/features/**/*.tsx', 'src/game/**/*.ts', 'src/game/**/*.tsx', 'src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@devtools/*', '../devtools/*', '../../devtools/*', '../../../devtools/*'],
            message: 'Product modules must not import devtools directly.',
          },
        ],
      }],
    },
  },
])
