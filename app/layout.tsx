import type { Metadata } from 'next';
import './globals.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';

import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import { getSiteUrl } from '@/lib/site-url';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Creator AI',
    template: '%s | Creator AI'
  },
  description: 'Creator AI, operacao de conteudo para empresas que precisam produzir com clareza e performance.',
  applicationName: 'Creator AI',
  icons: {
    icon: '/icon',
    apple: '/apple-icon'
  },
  manifest: '/manifest.json'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          {children}
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
