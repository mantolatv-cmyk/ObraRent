import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content px-4 pb-16 pt-12 sm:px-6">
        <Card className="mx-auto max-w-lg border-yellow-400/30">
          <CardBody className="flex flex-col items-start gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-400/40 bg-yellow-400/15 text-yellow-400 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)]"
            >
              <Compass className="h-6 w-6" />
            </span>
            <div>
              <p className="font-mono text-sm font-semibold text-yellow-400">ERRO 404</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Página ou pedido não encontrado</h1>
              <p className="mt-2 text-base text-slate-300">
                Verifique se o endereço está correto ou volte para o catálogo de equipamentos.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
              <Link href="/" className={buttonClasses({ variant: 'primary', className: 'flex-1' })}>
                <ArrowLeft aria-hidden className="h-5 w-5" />
                Ver catálogo
              </Link>
              <Link href="/alugar" className={buttonClasses({ variant: 'secondary', className: 'flex-1' })}>
                Fazer novo pedido
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
