'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutGrid, LogOut, MessageSquare, User, Zap } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { href: '/', label: 'Catálogo', Icon: LayoutGrid },
  { href: '/minhas-locacoes', label: 'Minhas Locações', Icon: Building2 },
  { href: '/whatsapp', label: 'Bot WhatsApp', Icon: MessageSquare },
] as const;

export function SiteHeader({ showRentCta = true }: { showRentCta?: boolean }) {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-yellow-400/20 bg-slate-950/80 text-white backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] print:hidden">
      <div className="mx-auto flex h-14 sm:h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 lg:gap-6">
          <Link
            href="/"
            className="-ml-1 flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            aria-label="Mantovani — página inicial"
          >
            <BrandMark className="h-7 w-7 sm:h-8 sm:w-8" />
            <div className="flex flex-col">
              <span className="bg-gradient-to-r from-white via-yellow-300 to-amber-400 bg-clip-text text-base sm:text-lg font-bold tracking-tight text-transparent leading-none">
                Mantovani
              </span>
              <span className="text-[10px] text-yellow-400/70 font-mono tracking-wider sm:hidden">
                Locação de Equipamentos
              </span>
            </div>
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1.5 md:flex">
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400',
                    active
                      ? 'border border-yellow-400/40 bg-yellow-400/15 text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.25)]'
                      : 'border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-yellow-300',
                  )}
                >
                  <Icon aria-hidden className={cn('h-4 w-4', active ? 'text-amber-400' : 'text-yellow-400/80')} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/minhas-locacoes"
                className="flex items-center gap-1.5 rounded-xl border border-yellow-400/35 bg-yellow-400/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-300 hover:border-yellow-400/60 shadow-[0_0_12px_rgba(250,204,21,0.15)] transition-all"
                title={user.companyName}
              >
                <User className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                <span className="max-w-[90px] truncate sm:max-w-[130px]">
                  {user.tradeName || user.companyName.split(' ')[0]}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-xl border border-white/10 p-1.5 text-slate-400 hover:border-red-400/40 hover:text-red-400 transition-colors"
                title="Sair da conta"
                aria-label="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-yellow-400/30 bg-slate-900/60 px-3 text-xs sm:text-sm font-semibold text-yellow-300 hover:border-yellow-400 hover:bg-yellow-400/10 shadow-[0_0_12px_rgba(250,204,21,0.15)] transition-all"
            >
              <User className="h-4 w-4 text-yellow-400" />
              <span>Entrar</span>
            </Link>
          )}

          {/* Quick status pill on mobile/desktop */}
          <Link
            href="/whatsapp"
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>WhatsApp 24h</span>
          </Link>

          {showRentCta ? (
            <Link
              href="/alugar"
              className={buttonClasses({
                variant: 'primary',
                className:
                  'hidden md:inline-flex h-10 min-h-10 px-4 text-sm sm:h-11 sm:min-h-11 sm:px-5 sm:text-base focus-visible:ring-offset-slate-950',
              })}
            >
              <Zap aria-hidden className="h-4 w-4" />
              Alugar agora
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
