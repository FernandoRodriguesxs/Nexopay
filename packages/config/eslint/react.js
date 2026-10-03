// @ts-check
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { nodeConfig } from './node.js';

/**
 * Preset para bibliotecas React (packages/ui).
 * @param {string} tsconfigRootDir
 */
export function reactConfig(tsconfigRootDir) {
  return tseslint.config(...nodeConfig(tsconfigRootDir), {
    languageOptions: { globals: { ...globals.browser } },
  });
}

export default reactConfig;
