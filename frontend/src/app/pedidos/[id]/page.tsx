import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { OrderStatusView } from '@/components/order/OrderStatusView';
import { getRentalSafe } from '@/lib/api/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await getRentalSafe(id);
  if (res.ok) {
    return {
      title: `Pedido ${res.data.code}`,
      description: `Acompanhe o status, equipamentos alocados e entrega do pedido ${res.data.code} na Mantovani.`,
    };
  }
  return {
    title: 'Acompanhar pedido',
  };
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRentalSafe(id);

  if (!result.ok && result.error.status === 404) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content px-3.5 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
        <OrderStatusView
          id={id}
          initialRental={result.ok ? result.data : null}
          initialError={!result.ok ? result.error : null}
        />
      </main>
      <SiteFooter />
    </>
  );
}
