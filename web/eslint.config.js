import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import i18nextPlugin from 'eslint-plugin-i18next'
import i18next from 'eslint-plugin-i18next';

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          framework: 'react',
          // Change to 'all' to check all literal strings
          mode: 'jsx-text-only',
          words: {
            exclude: ['^.$']
          },
        },
      ],
    },
    plugins: {
      i18next: i18nextPlugin,
    }
  },
])
