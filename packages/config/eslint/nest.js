// @ts-check
import tseslint from 'typescript-eslint';
import { nodeConfig } from './node.js';

/**
 * Preset para NestJS. Classes com decorators frequentemente são "vazias"
 * (módulos) e usam parâmetros apenas para injeção de dependência.
 * @param {string} tsconfigRootDir
 */
export function nestConfig(tsconfigRootDir) {
  return tseslint.config(...nodeConfig(tsconfigRootDir), {
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/parameter-properties': 'off',
      // Nest exige imports de valor para classes injetadas (emitDecoratorMetadata).
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  });
}

export default nestConfig;
