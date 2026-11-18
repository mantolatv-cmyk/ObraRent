'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutGrid, MessageSquare, User, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  badge?: string;
  isCta?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Catálogo',
    icon: LayoutGrid,
  },
  {
    href: '/minhas-locacoes',
    label: 'Locações',
    icon: Building2,
  },
  {
    href: '/whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    badge: '24h',
  },
  {
    href: '/login',
    label: 'Conta',
    icon: User,
  },
  {
    href: '/alugar',
    label: 'Alugar',
    icon: Zap,
    isCta: true,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide bottom tab bar during checkout flow or contract print view
  if (pathname?.startsWith('/alugar') || pathname?.includes('/contrato')) {
    return null;
  }

  return (
    <nav
      aria-label="Navegação inferior mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-yellow-400/25 bg-slate-950/90 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.6)] md:hidden print:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge, isCta }) => {
          const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href);

          if (isCta) {
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-2xl px-4 py-1.5 transition-all active:scale-95',
                  isActive
                    ? 'bg-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.5)] font-bold'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.35)] font-bold hover:brightness-110',
                )}
              >
                <Icon aria-hidden className="h-5 w-5" />
                <span className="text-[11px] leading-tight tracking-tight">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center rounded-xl py-1 transition-all active:scale-95',
                isActive
                  ? 'text-yellow-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <div className="relative">
                <Icon
                  aria-hidden
                  className={cn(
                    'h-5 w-5 transition-transform',
                    isActive ? 'scale-110 text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-slate-400',
                  )}
                />
                {badge ? (
                  <span className="absolute -right-2.5 -top-1 flex h-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[9px] font-bold text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                    {badge}
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  'mt-0.5 text-[10px] tracking-tight',
                  isActive ? 'text-yellow-300 font-semibold' : 'text-slate-400',
                )}
              >
                {label}
              </span>
              {isActive ? (
                <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
