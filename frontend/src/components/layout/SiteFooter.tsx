import Link from 'next/link';
import { BrandMark } from '@/components/layout/BrandMark';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60 pb-28 pt-8 sm:py-8 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-content flex-col gap-3 px-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-6 w-6" />
          <p className="text-slate-300">
            © {new Date().getFullYear()} <strong className="font-semibold text-white">Mantovani</strong> · Locação de
            equipamentos para obras e reformas
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center text-slate-300 transition-colors hover:text-yellow-400"
          >
            Catálogo
          </Link>
          <Link
            href="/minhas-locacoes"
            className="inline-flex min-h-10 items-center text-slate-300 transition-colors hover:text-yellow-400"
          >
            Minhas Locações
          </Link>
          <Link
            href="/whatsapp"
            className="inline-flex min-h-10 items-center text-slate-300 transition-colors hover:text-yellow-400"
          >
            Bot WhatsApp
          </Link>
          <Link
            href="/alugar"
            className="inline-flex min-h-10 items-center font-semibold text-amber-400 transition-colors hover:text-yellow-400"
          >
            Alugar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
