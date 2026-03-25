import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ContentOS',
    short_name: 'ContentOS',
    description: 'Sistema operacional de produção de conteúdo com IA',
    start_url: '/demo/dashboard',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
}
