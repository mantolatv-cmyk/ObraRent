import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { BottomNav } from '@/components/layout/BottomNav';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { AuthProvider } from '@/lib/auth/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Mantovani — Locação de Equipamentos para Obra e Reforma',
    template: '%s · Mantovani',
  },
  description:
    'Alugue compactadores, marteletes, placas vibratórias, andaimes e ferramentas para sua obra ou reforma. Atendimento rápido com aprovação instantânea no Pix e entrega no local.',
  applicationName: 'Mantovani',
  appleWebApp: { capable: true, title: 'Mantovani', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-[#070b12] text-slate-100">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-gradient-to-r focus:from-amber-400 focus:to-yellow-400 focus:px-4 focus:py-3 focus:font-bold focus:text-slate-950 focus:shadow-[0_0_24px_rgba(250, 204, 21, 0.25)]"
        >
          Pular para o conteúdo
        </a>
        <AuthProvider>
          {children}
          <BottomNav />
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
