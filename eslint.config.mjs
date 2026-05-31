import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import eslintPluginYml from 'eslint-plugin-yml'
import eslintPluginPrettier from 'eslint-plugin-prettier' // 1. 显式引入 prettier 插件

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  {
    // 全局忽略
    ignores: ['next-env.d.ts', 'next.config.js'],
  },

  // ==================== JS / TS / React 配置 ====================
  ...compat
    .extends(
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:jsx-a11y/recommended',
      'plugin:prettier/recommended',
      'next',
      'next/core-web-vitals'
    )
    .map((config) => ({
      ...config,
      files: ['**/*.{js,jsx,ts,tsx}'],
    })),

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    // 2. 显式将 prettier 插件注册到当前配置块中
    plugins: {
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.amd,
        ...globals.node,
      },
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          components: ['Link'],
          specialLink: ['hrefLeft', 'hrefRight'],
          aspects: ['invalidHref', 'preferButton'],
        },
      ],
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // ==================== YAML / YML 配置 ====================
  ...eslintPluginYml.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.{yaml,yml}'],
  })),
  ...eslintPluginYml.configs['flat/prettier'].map((config) => ({
    ...config,
    files: ['**/*.{yaml,yml}'],
  })),
  {
    files: ['**/*.{yaml,yml}'],
    plugins: {
      prettier: eslintPluginPrettier, // 3. YAML 块也加上它
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
]
