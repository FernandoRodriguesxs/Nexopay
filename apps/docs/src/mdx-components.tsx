import type { MDXComponents } from 'mdx/types';

// Ponto central para mapear elementos MDX para componentes do Design System
// (CodeBlock, CopyButton, tabelas de parâmetros...).
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}
