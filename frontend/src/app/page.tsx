import Link from 'next/link';
import { ArrowRight, Clock, QrCode, ShieldCheck, Truck, WifiOff } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { getCategoriesSafe } from '@/lib/api/server';
import { whatsappLink } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await getCategoriesSafe();

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content px-3.5 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
        {/* Hero Banner Mobile-First */}
        <section
          aria-labelledby="hero-title"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-yellow-400/25 bg-slate-900/65 p-4 sm:p-10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.55)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-400/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl"
          />

          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 font-mono text-[11px] sm:text-xs font-semibold tracking-wider text-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.25)]">
              ⚡ LOCAÇÃO DE EQUIPAMENTOS · PESSOA FÍSICA E EMPRESAS
            </span>

            <h1
              id="hero-title"
              className="mt-3 bg-gradient-to-r from-white via-yellow-300 to-amber-400 bg-clip-text text-2xl font-black leading-tight tracking-tight text-transparent sm:text-5xl"
            >
              Equipamento pesado na obra, em minutos e no celular.
            </h1>

            <p className="mt-2.5 max-w-2xl text-sm sm:text-lg text-slate-300 leading-relaxed">
              Reserva imediata com Pix instantâneo, contrato digital na hora e entrega expressa para sua reforma, construção ou empresa.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <Link
                href="/alugar"
                className={buttonClasses({
                  variant: 'primary',
                  size: 'lg',
                  className: 'w-full sm:w-auto h-12 min-h-12 font-bold justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)]',
                })}
              >
                Alugar Agora pelo App
                <ArrowRight aria-hidden className="h-5 w-5" />
              </Link>
              <Link
                href="/whatsapp"
                className={buttonClasses({
                  variant: 'secondary',
                  size: 'lg',
                  className: 'w-full sm:w-auto h-12 min-h-12 justify-center border-white/15',
                })}
              >
                Tirar Dúvidas no WhatsApp
              </Link>
            </div>

            {/* Horizontal swipeable pills on mobile */}
            <ul className="mt-5 flex gap-2 overflow-x-auto no-scrollbar snap-x border-t border-white/10 pt-4 text-xs sm:text-sm text-slate-200 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <li className="flex shrink-0 snap-start items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 sm:px-3.5 sm:py-2.5">
                <QrCode aria-hidden className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="whitespace-nowrap">Pix aprovado na hora</span>
              </li>
              <li className="flex shrink-0 snap-start items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 sm:px-3.5 sm:py-2.5">
                <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-yellow-400" />
                <span className="whitespace-nowrap">Reserva 100% garantida</span>
              </li>
              <li className="flex shrink-0 snap-start items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 sm:px-3.5 sm:py-2.5">
                <Truck aria-hidden className="h-4 w-4 shrink-0 text-yellow-400" />
                <span className="whitespace-nowrap">Entrega no canteiro</span>
              </li>
              <li className="flex shrink-0 snap-start items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 sm:px-3.5 sm:py-2.5">
                <Clock aria-hidden className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="whitespace-nowrap">Até 20% off mensal</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Catalog Grid */}
        <section aria-labelledby="catalogo-title" className="mt-6 sm:mt-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="catalogo-title" className="text-xl sm:text-2xl font-bold text-white">
                Catálogo de Equipamentos
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                Estoque físico monitorado em tempo real
              </p>
            </div>
            {result.ok && result.data.length > 0 ? (
              <Badge tone="accent" dot className="tabular-nums text-xs">
                {result.data.length} disponíveis
              </Badge>
            ) : null}
          </div>

          {!result.ok ? (
            <Alert
              tone="warning"
              className="mt-4"
              title="Não foi possível carregar o catálogo agora"
              action={
                <div className="flex flex-wrap gap-3">
                  <Link href="/" className={buttonClasses({ variant: 'dark' })} prefetch={false}>
                    Tentar novamente
                  </Link>
                  <a
                    href={whatsappLink('alugar')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: 'secondary' })}
                  >
                    Alugar pelo WhatsApp
                  </a>
                </div>
              }
            >
              <span className="flex items-center gap-2">
                <WifiOff aria-hidden className="h-4 w-4" /> {result.error.message}
              </span>
            </Alert>
          ) : result.data.length === 0 ? (
            <Alert tone="info" className="mt-4" title="Nenhum equipamento cadastrado ainda">
              Fale com a gente pelo WhatsApp para uma cotação personalizada.
            </Alert>
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.data.map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
