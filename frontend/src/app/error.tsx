'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, MessageCircle, RotateCcw } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { whatsappLink } from '@/lib/config';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content px-4 pb-16 pt-12 sm:px-6">
        <Card className="mx-auto max-w-lg border-rose-500/35">
          <CardBody className="flex flex-col items-start gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/15 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.25)]"
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-white">Ocorreu um erro inesperado</h1>
              <p className="mt-2 text-base text-slate-300">
                Não foi possível concluir esta operação agora. Você pode tentar novamente ou falar direto com nossa
                equipe pelo WhatsApp.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => reset()} className="flex-1">
                <RotateCcw aria-hidden className="h-5 w-5" />
                Tentar novamente
              </Button>
              <a
                href={whatsappLink('Preciso de ajuda com meu pedido')}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary', className: 'flex-1' })}
              >
                <MessageCircle aria-hidden className="h-5 w-5" />
                Chamar no WhatsApp
              </a>
            </div>
            <Link href="/" className="text-sm font-semibold text-yellow-400 underline underline-offset-4 hover:text-yellow-400">
              Voltar para o catálogo
            </Link>
          </CardBody>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
