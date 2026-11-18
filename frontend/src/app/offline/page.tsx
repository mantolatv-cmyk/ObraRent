import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, RotateCcw, WifiOff } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { whatsappLink } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Sem conexão',
};

export default function OfflinePage() {
  return (
    <>
      <SiteHeader showRentCta={false} />
      <main id="conteudo" className="mx-auto max-w-content px-4 pb-16 pt-12 sm:px-6">
        <Card className="mx-auto max-w-lg border-amber-400/30">
          <CardBody className="flex flex-col items-start gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.22)]"
            >
              <WifiOff className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-white">Você está sem conexão</h1>
              <p className="mt-2 text-base text-slate-300">
                Verifique o sinal de internet no canteiro de obras e tente novamente. Seus itens selecionados ficam
                salvos no aparelho.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
              <Link href="/" prefetch={false} className={buttonClasses({ variant: 'primary', className: 'flex-1' })}>
                <RotateCcw aria-hidden className="h-5 w-5" />
                Tentar reconectar
              </Link>
              <a
                href={whatsappLink('alugar')}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary', className: 'flex-1' })}
              >
                <MessageCircle aria-hidden className="h-5 w-5" />
                Alugar pelo WhatsApp
              </a>
            </div>
            <Link href="/alugar" className="text-sm font-semibold text-yellow-400 underline underline-offset-4 hover:text-yellow-400">
              Voltar para o pedido em andamento
            </Link>
          </CardBody>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
