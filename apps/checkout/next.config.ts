import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// O .env vive na raiz do monorepo. `forceReload` é necessário porque o Next já
// carregou (e cacheou) o diretório do app na mesma instância de @next/env.
const isDev = process.env.NODE_ENV !== 'production';
loadEnvConfig(resolve(process.cwd(), '../..'), isDev, undefined, true);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@nexopay/ui'],
  typedRoutes: true,
};

export default nextConfig;
