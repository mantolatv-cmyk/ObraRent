import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo"
        aria-busy="true"
        aria-label="Carregando conteúdo"
        className="mx-auto max-w-content px-4 pb-16 pt-8 sm:px-6 sm:pt-12"
      >
        <div className="max-w-xl space-y-3">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-full" />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-7 w-32 rounded-full" />
              </div>
              <Skeleton className="mt-5 h-14 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
