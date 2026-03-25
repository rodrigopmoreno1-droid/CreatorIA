import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Creator AI',
    short_name: 'CreatorAI',
    description: 'Creator AI, operacao de conteudo para empresas.',
    start_url: '/',
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
