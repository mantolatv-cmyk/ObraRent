import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CheckoutWizard } from '@/components/checkout/CheckoutWizard';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCategoriesSafe } from '@/lib/api/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Alugar equipamento',
  description: 'Escolha os equipamentos, defina o período e pague no Pix com aprovação instantânea.',
};

function WizardFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando formulário de locação">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="hidden h-80 w-full rounded-2xl lg:block" />
      </div>
    </div>
  );
}

export default async function AlugarPage() {
  const result = await getCategoriesSafe();

  return (
    <>
      <SiteHeader showRentCta={false} />
      <main id="conteudo" className="mx-auto max-w-content px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Suspense fallback={<WizardFallback />}>
          <CheckoutWizard initialCategories={result.ok ? result.data : null} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
