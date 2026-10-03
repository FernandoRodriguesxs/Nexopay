// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Regras inegociáveis do NexoPay (ver CLAUDE.md):
 * - sem `any`, sem `@ts-ignore`
 * - sem `console.*` (use @nexopay/logger)
 * - promises sempre tratadas
 */
export const nexopayRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-check': false,
      'ts-expect-error': 'allow-with-description',
      minimumDescriptionLength: 10,
    },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  'no-console': 'error',
  eqeqeq: ['error', 'always'],
  'prefer-const': 'error',
  'no-var': 'error',
  curly: ['error', 'multi-line'],
};

export const ignores = {
  ignores: [
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/src/generated/**',
    '**/next-env.d.ts',
  ],
};

/**
 * Preset para pacotes/aplicações Node (ESM).
 * @param {string} tsconfigRootDir diretório do workspace (use `import.meta.dirname`).
 */
export function nodeConfig(tsconfigRootDir) {
  return tseslint.config(
    ignores,
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: nexopayRules,
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  );
}

export default nodeConfig;
