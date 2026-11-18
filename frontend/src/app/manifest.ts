import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mantovani — Aluguel de equipamentos para obra',
    short_name: 'Mantovani',
    description: 'Alugue compactadores, marteletes, placas vibratórias e andaimes com aprovação instantânea no Pix.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070b12',
    theme_color: '#070b12',
    lang: 'pt-BR',
    categories: ['business', 'productivity'],
    shortcuts: [
      {
        name: 'Alugar Equipamento',
        short_name: 'Alugar',
        description: 'Faça um novo pedido de locação rápida',
        url: '/alugar',
        icons: [{ src: '/icons/192', sizes: '192x192' }],
      },
      {
        name: 'WhatsApp 24h',
        short_name: 'WhatsApp',
        description: 'Tire dúvidas e faça pedidos no WhatsApp',
        url: '/whatsapp',
        icons: [{ src: '/icons/192', sizes: '192x192' }],
      },
      {
        name: 'Minhas Locações',
        short_name: 'Locações',
        description: 'Acompanhe seus contratos e equipamentos',
        url: '/minhas-locacoes',
        icons: [{ src: '/icons/192', sizes: '192x192' }],
      },
    ],
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
