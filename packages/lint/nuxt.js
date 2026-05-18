import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/coverage/**',
]

export default tseslint.config(
  { ignores },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...vue.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
  eslintConfigPrettier,
)
