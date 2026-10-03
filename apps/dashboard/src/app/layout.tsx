import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/env';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NexoPay Dashboard', template: '%s · NexoPay' },
  description: 'Infraestrutura de pagamentos developer-first.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
