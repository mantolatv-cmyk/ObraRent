'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  HardHat,
  Printer,
  RefreshCw,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { StatusBadge } from '@/components/order/StatusTimeline';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, errorMessage } from '@/lib/api';
import {
  formatBRL,
  formatDateLong,
  formatDateTime,
  FREIGHT_ZONE_LABEL,
  maskCep,
  maskCpfOrCnpj,
  maskPhone,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import type { ContractDocument } from '@/lib/types';

export default function RentalContractPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [doc, setDoc] = useState<ContractDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRentalContract(id);
      setDoc(data);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível carregar o contrato e romaneio deste pedido.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-content space-y-6 px-4 py-8 sm:px-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-[640px] w-full rounded-2xl" />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (error || !doc) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-content space-y-6 px-4 py-8 sm:px-6">
          <Alert
            tone="danger"
            title="Contrato indisponível"
            action={
              <div className="flex flex-wrap gap-3">
                <Button variant="dark" onClick={() => void loadContract()}>
                  <RefreshCw aria-hidden className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Link href={`/pedidos/${encodeURIComponent(id)}`} className={buttonClasses({ variant: 'secondary' })}>
                  Voltar ao pedido
                </Link>
              </div>
            }
          >
            {error ?? 'Não foi possível localizar o documento.'}
          </Alert>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { rental, lessor, lessee, assets, totalReplacementValue } = doc;
  const addr = rental.deliveryAddress;

  return (
    <>
      <SiteHeader />

      {/* Embedded Global Print Styles for Strict Single-Page Printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 7mm;
          }
          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9.5px !important;
            line-height: 1.25 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          nav,
          header.site-header,
          footer,
          .no-print {
            display: none !important;
          }
          .contract-sheet {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 5mm 6mm !important;
            margin: 0 auto !important;
            max-width: 100% !important;
          }
          .contract-sheet * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>

      <main
        id="conteudo"
        className="mx-auto max-w-content space-y-4 px-3 pb-16 pt-4 sm:px-6 sm:space-y-6 sm:pt-6 print:max-w-none print:p-0 print:space-y-0"
      >
        {/* Top Action Bar (Hidden on print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yellow-400/25 bg-slate-900/65 p-3.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/pedidos/${encodeURIComponent(rental.id)}`}
              className={buttonClasses({ variant: 'secondary', size: 'md' })}
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Voltar ao Pedido ({rental.code})
            </Link>
            <Link href="/minhas-locacoes" className={buttonClasses({ variant: 'ghost', size: 'md' })}>
              Minhas Locações
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-400 sm:inline">Página única A4</span>
            <Button variant="primary" size="md" onClick={handlePrint}>
              <Printer aria-hidden className="h-4 w-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* Single-Page Contract Sheet: Dark Glassmorphism on Screen, Crisp 1-Page Document on Print */}
        <article className="contract-sheet space-y-3.5 rounded-2xl border border-yellow-400/25 bg-slate-900/80 p-5 text-slate-100 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.55)] sm:p-7 print:space-y-2 print:border-slate-300 print:bg-white print:p-3 print:text-slate-900">
          {/* Header Compacto */}
          <header className="flex flex-col justify-between gap-2.5 border-b border-yellow-400/40 pb-2.5 sm:flex-row sm:items-center print:border-slate-900 print:pb-1.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-yellow-400 print:text-slate-900">
                <HardHat aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-yellow-400 print:text-slate-900">
                  {lessor.tradeName} · Locação de Equipamentos
                </span>
              </div>
              <h1 className="text-base font-bold uppercase tracking-tight text-white sm:text-lg print:text-slate-950">
                Contrato de Locação de Bens Móveis &amp; Romaneio de Expedição
              </h1>
              <p className="text-[11px] text-slate-400 print:text-slate-600">
                Art. 565 e seguintes do Código Civil Brasileiro (Lei nº 10.406/2002) · Sem Cessão de Mão de Obra
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-yellow-400/30 bg-slate-950/70 px-3 py-1.5 text-xs sm:flex-col sm:items-end sm:py-1 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 print:text-slate-600">Contrato:</span>
                <span className="font-mono text-sm font-bold text-yellow-400 print:text-slate-950">{rental.code}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 print:text-slate-600">
                <span>Doc: {doc.documentNumber}</span>
                <span>·</span>
                <span>{formatDateTime(doc.issuedAt)}</span>
              </div>
              <div className="sm:mt-0.5">
                <StatusBadge status={rental.status} />
              </div>
            </div>
          </header>

          {/* QUADRO I & II UNIFICADOS — PARTES & LOCAL DA OBRA (Grid 3 colunas compacto) */}
          <section className="space-y-1.5">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-900">
              <Building2 aria-hidden="true" className="h-3.5 w-3.5 text-yellow-400 print:text-slate-900" />
              Quadro I — Partes Contratantes &amp; Canteiro de Obras
            </h2>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 print:grid-cols-3 print:gap-1.5">
              {/* Locadora */}
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px] leading-tight print:border-slate-200 print:bg-slate-50/70 print:p-1.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-500">
                  Locadora (Proprietária)
                </p>
                <p className="mt-0.5 font-bold text-white print:text-slate-950">{lessor.companyName}</p>
                <p className="text-slate-300 print:text-slate-700">CNPJ: {lessor.cnpj}</p>
                <p className="text-slate-400 print:text-slate-600 truncate">{lessor.address}</p>
                <p className="text-slate-400 print:text-slate-600">{lessor.phone} · {lessor.email}</p>
              </div>

              {/* Locatária */}
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px] leading-tight print:border-slate-200 print:bg-slate-50/70 print:p-1.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400 print:text-slate-500">
                  Locatária (Cliente)
                </p>
                <p className="mt-0.5 font-bold text-white print:text-slate-950">{lessee.companyName}</p>
                <p className="font-mono text-yellow-400 print:text-slate-800">
                  Doc: {maskCpfOrCnpj(lessee.cnpj)}
                </p>
                <p className="text-slate-400 print:text-slate-600 truncate">
                  {lessee.email ?? 'Não informado'}
                </p>
                <p className="text-slate-400 print:text-slate-600">
                  Tel: {lessee.phone ? maskPhone(lessee.phone) : 'Não informado'}
                </p>
              </div>

              {/* Obra & Vigência */}
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px] leading-tight print:border-slate-200 print:bg-slate-50/70 print:p-1.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-500">
                  Canteiro &amp; Vigência
                </p>
                <p className="mt-0.5 font-bold text-white print:text-slate-950 truncate">
                  {addr.street}, {addr.number}{addr.complement ? ` · ${addr.complement}` : ''}
                </p>
                <p className="text-slate-300 print:text-slate-700">
                  {addr.district} · {addr.city}/{addr.state} · CEP {maskCep(addr.cep)}
                </p>
                <p className="mt-0.5 text-slate-300 print:text-slate-800">
                  {formatDateLong(rental.startDate)} até {formatDateLong(rental.endDate)} (<strong>{rental.days} diárias</strong>)
                </p>
                {rental.deliveryTimeSlot ? (
                  <p className="mt-0.5 text-yellow-400 print:text-slate-900 font-semibold">
                    Janela de Entrega: {rental.deliveryTimeSlot}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* QUADRO II — ROMANEIO DE EQUIPAMENTOS FÍSICOS & RISCO PATRIMONIAL */}
          <section className="space-y-1.5">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-900">
              <Tag aria-hidden="true" className="h-3.5 w-3.5 text-yellow-400 print:text-slate-900" />
              Quadro II — Romaneio de Equipamentos Físicos &amp; Risco Patrimonial
            </h2>

            <div className="overflow-x-auto rounded-lg border border-white/15 print:border-slate-200">
              <table className="w-full text-left text-[11px] print:text-[9.5px]">
                <thead className="border-b border-white/15 bg-slate-950/80 font-semibold uppercase text-yellow-400 print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                  <tr>
                    <th className="px-2.5 py-1.5 print:px-1.5 print:py-1">Patrimônio (Tag)</th>
                    <th className="px-2.5 py-1.5 print:px-1.5 print:py-1">Nº Série</th>
                    <th className="px-2.5 py-1.5 print:px-1.5 print:py-1">Equipamento</th>
                    <th className="px-2.5 py-1.5 text-right print:px-1.5 print:py-1">Diária</th>
                    <th className="px-2.5 py-1.5 text-right print:px-1.5 print:py-1">Reposição (Un.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 print:divide-slate-200">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="bg-slate-900/50 print:bg-white">
                      <td className="px-2.5 py-1 font-mono font-bold text-yellow-400 print:px-1.5 print:text-slate-950">
                        {asset.assetTag}
                      </td>
                      <td className="px-2.5 py-1 font-mono text-slate-300 print:px-1.5 print:text-slate-700">
                        {asset.serialNumber ?? 'S/N'}
                      </td>
                      <td className="px-2.5 py-1 font-medium text-white print:px-1.5 print:text-slate-900">
                        {asset.categoryName}
                      </td>
                      <td className="px-2.5 py-1 text-right text-amber-400 tabular-nums print:px-1.5 print:text-slate-900">
                        {formatBRL(asset.agreedDailyRate)}
                      </td>
                      <td className="px-2.5 py-1 text-right font-semibold text-white tabular-nums print:px-1.5 print:text-slate-900">
                        {formatBRL(asset.replacementCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-yellow-400/35 bg-slate-950/80 font-semibold print:border-slate-300 print:bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-2.5 py-1 text-right text-slate-300 print:px-1.5 print:text-slate-700">
                      Valor Total de Risco Patrimonial (Base de Reposição / Seguro):
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono font-bold text-amber-400 tabular-nums print:px-1.5 print:text-slate-950">
                      {formatBRL(totalReplacementValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* QUADRO III — DEMONSTRATIVO FINANCEIRO COMPACTO */}
          <section className="space-y-1.5">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-900">
              <FileText aria-hidden="true" className="h-3.5 w-3.5 text-yellow-400 print:text-slate-900" />
              Quadro III — Demonstrativo Financeiro
            </h2>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px] sm:grid-cols-4 print:grid-cols-4 print:border-slate-200 print:bg-slate-50/70 print:p-1.5">
              <div>
                <span className="text-[10px] text-slate-400 print:text-slate-600 block">Subtotal Diárias ({rental.days}d)</span>
                <span className="font-semibold text-white print:text-slate-900">{formatBRL(rental.subtotal)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 print:text-slate-600 block">
                  Frete ({FREIGHT_ZONE_LABEL[rental.freight.zone]})
                </span>
                <span className="font-semibold text-emerald-400 print:text-slate-900">
                  {rental.freight.amount > 0 ? formatBRL(rental.freight.amount) : 'Grátis (Incluso)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 print:text-slate-600 block">Condição de Pgto</span>
                <span className="font-semibold text-white print:text-slate-900">
                  {rental.payment ? `${PAYMENT_METHOD_LABEL[rental.payment.method]} (${rental.payment.status})` : 'A faturar'}
                </span>
              </div>
              <div className="border-l border-white/15 pl-2 print:border-slate-300">
                <span className="text-[10px] text-slate-400 print:text-slate-600 block">Valor Total do Contrato</span>
                <span className="font-mono text-sm font-bold text-amber-400 print:text-slate-950">{formatBRL(rental.totalAmount)}</span>
                {rental.subtotal > rental.totalAmount ? (
                  <span className="block text-[9.5px] font-semibold text-emerald-400 print:text-emerald-700">
                    (-8% desc. dinheiro: -{formatBRL(rental.subtotal - rental.totalAmount)})
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {/* QUADRO IV — CLÁUSULAS ESSENCIAIS CONDENSADAS (1 folha) */}
          <section className="space-y-1">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-yellow-400 print:text-slate-900">
              <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5 text-yellow-400 print:text-slate-900" />
              Quadro IV — Cláusulas Essenciais &amp; Responsabilidades (Art. 565 do Código Civil)
            </h2>

            <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2 text-[10px] leading-tight text-slate-300 print:border-slate-200 print:bg-white print:p-1.5 print:text-[8.5px] print:text-slate-700">
              <p>
                <strong>1. Objeto &amp; Posse:</strong> A LOCADORA cede a posse direta dos bens descritos no Quadro II em perfeito estado mecânico e elétrico conforme NR-12 e NR-18.
                <strong> 2. Guarda &amp; Fiel Depositário:</strong> A LOCATÁRIA assume a guarda e integridade dos bens a partir do descarregamento no canteiro, respondendo por avarias, furto ou extravio até o limite do Valor de Reposição ({formatBRL(totalReplacementValue)}).
                <strong> 3. Manutenção &amp; EPI:</strong> Operação restrita a profissionais capacitados com EPI. Vícios mecânicos de desgaste natural serão reparados ou substituídos pela LOCADORA sem ônus de diária durante o período inoperante.
                <strong> 4. Devolução &amp; Prorrogação:</strong> Diárias excedentes serão cobradas automaticamente na permanência além do término contratado até a efetiva devolução e conferência física no pátio da LOCADORA.
              </p>
            </div>
          </section>

          {/* QUADRO V — VISTORIA NO CANTEIRO & TERMO DE ASSINATURA */}
          <section className="space-y-2 pt-1 print:space-y-1.5">
            {/* Checklist rápido de vistoria */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-slate-950/70 px-3 py-1.5 text-[10px] print:border-slate-300 print:bg-slate-50 print:text-[8.5px]">
              <span className="flex items-center gap-1 text-slate-200 print:text-slate-900 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 print:text-slate-800" />
                Vistoria de Campo:
              </span>
              <span className="text-slate-300 print:text-slate-700">[✓] Máquinas testadas e operacionais</span>
              <span className="text-slate-300 print:text-slate-700">[✓] Cabos, proteções e sapatas conferidos</span>
              <span className="text-slate-300 print:text-slate-700">[✓] Plaquetas patrimoniais íntegras</span>
            </div>

            {/* Linhas de Assinatura */}
            <div className="grid grid-cols-2 gap-4 pt-4 print:pt-3">
              <div className="border-t border-white/30 pt-1.5 text-center print:border-slate-900">
                <p className="font-bold text-white text-[11px] print:text-[9.5px] print:text-slate-950">{lessor.companyName}</p>
                <p className="text-[10px] text-slate-400 print:text-[8px] print:text-slate-600">
                  Expedição / Logística · Mantovani
                </p>
              </div>

              <div className="border-t border-white/30 pt-1.5 text-center print:border-slate-900">
                <p className="font-bold text-white text-[11px] print:text-[9.5px] print:text-slate-950">{lessee.companyName}</p>
                <p className="text-[10px] text-slate-400 print:text-[8px] print:text-slate-600">
                  Recebedor no Canteiro (Nome legível, Doc e Assinatura)
                </p>
              </div>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
