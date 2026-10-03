// @ts-check
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { ignores, nexopayRules } from './node.js';

/**
 * Preset para aplicações Next.js (App Router).
 * @param {string} tsconfigRootDir
 */
export function nextConfig(tsconfigRootDir) {
  return tseslint.config(
    ignores,
    ...nextVitals,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: nexopayRules,
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}

export default nextConfig;
