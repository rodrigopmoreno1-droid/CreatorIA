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

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: {
    default: 'ContentOS',
    template: '%s | ContentOS'
  },
  description: 'Sistema operacional de produção de conteúdo com IA, multiempresa e PWA.',
  applicationName: 'ContentOS',
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
