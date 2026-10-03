import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  transpilePackages: ['@nexopay/ui'],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
