'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FlaskConical,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { api, errorMessage } from '@/lib/api';
import { SHOW_DEV_SIMULATOR } from '@/lib/config';
import {
  formatBRL,
  formatCountdown,
  formatDateTime,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

export interface PaymentPanelProps {
  rental: RentalSummary;
  polling?: boolean;
  onRentalUpdate?: (rental: RentalSummary) => void;
  showOrderPageLink?: boolean;
}

export function PaymentPanel({
  rental,
  polling = false,
  onRentalUpdate,
  showOrderPageLink = false,
}: PaymentPanelProps) {
  const payment = rental.payment;
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const expiresAt = payment?.expiresAt;
    if (!expiresAt || rental.status !== 'PENDING_PAYMENT') {
      setRemainingMs(null);
      return;
    }
    const target = new Date(expiresAt).getTime();
    if (Number.isNaN(target)) {
      setRemainingMs(null);
      return;
    }
    const update = () => setRemainingMs(Math.max(0, target - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [payment?.expiresAt, rental.status]);

  const handleCopyPix = async () => {
    if (!payment?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payment.pixCopyPaste;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSimulatePayment = async () => {
    setSimulating(true);
    setSimError(null);
    try {
      const updated = await api.simulatePayment(rental.id);
      onRentalUpdate?.(updated);
    } catch (e) {
      setSimError(errorMessage(e, 'Não foi possível simular o pagamento.'));
    } finally {
      setSimulating(false);
    }
  };

  if (!payment) {
    return (
      <Card>
        <CardBody>
          <p className="text-base text-slate-300">Informações de pagamento indisponíveis para este pedido.</p>
        </CardBody>
      </Card>
    );
  }

  const isPix = payment.method === 'PIX';
  const expired = remainingMs !== null && remainingMs <= 0 && rental.status === 'PENDING_PAYMENT';

  return (
    <Card className="border-yellow-400/30">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span>Pagamento via {PAYMENT_METHOD_LABEL[payment.method]}</span>
            {isPix ? <Badge tone="accent">Aprovação instantânea</Badge> : null}
          </span>
        }
        description={
          <span>
            Pedido <strong className="font-mono font-semibold text-yellow-400">{rental.code}</strong> · Total{' '}
            <strong className="font-semibold text-amber-400 tabular-nums">{formatBRL(rental.totalAmount)}</strong>
          </span>
        }
        action={
          remainingMs !== null && rental.status === 'PENDING_PAYMENT' ? (
            <Badge tone={expired ? 'danger' : remainingMs < 300_000 ? 'warning' : 'neutral'}>
              <Clock aria-hidden className="h-3.5 w-3.5" />
              <span className="font-mono tabular-nums">
                {expired ? 'Expirado' : `Expira em ${formatCountdown(remainingMs)}`}
              </span>
            </Badge>
          ) : null
        }
      />

      <CardBody className="space-y-5">
        {isPix ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:items-center">
            {/* High-contrast white QR Code pad framed inside a neon-bordered glass card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-yellow-400/40 bg-slate-950/75 p-4 shadow-[0_0_26px_rgba(250, 204, 21, 0.25)]">
              {payment.pixQrCodeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={payment.pixQrCodeImage}
                  alt={`QR Code Pix do pedido ${rental.code}`}
                  width={200}
                  height={200}
                  className="h-48 w-48 rounded-xl bg-white p-2.5 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                />
              ) : payment.pixCopyPaste ? (
                <div className="rounded-xl bg-white p-3 shadow-[0_0_20px_rgba(255,255,255,0.25)]">
                  <QRCodeSVG
                    value={payment.pixCopyPaste}
                    size={184}
                    level="M"
                    includeMargin={false}
                    aria-label={`QR Code Pix do pedido ${rental.code}`}
                  />
                </div>
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
                  <QrCode aria-hidden className="h-10 w-10 text-yellow-400" />
                  <span>Use o código Pix Copia e Cola ao lado</span>
                </div>
              )}
              <p className="mt-2.5 text-center text-xs font-medium text-yellow-400">Escaneie no app do seu banco</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">Pix Copia e Cola</p>
                <p className="mt-0.5 text-sm text-slate-300">
                  Copie o código abaixo e cole na opção <strong className="text-yellow-400">Pix Copia e Cola</strong> do
                  seu banco:
                </p>
              </div>

              {payment.pixCopyPaste ? (
                <>
                  <div
                    aria-label="Código Pix Copia e Cola"
                    className="max-h-28 overflow-y-auto break-all rounded-xl border border-yellow-400/30 bg-slate-950/80 p-3 font-mono text-xs leading-relaxed text-yellow-400 select-all"
                  >
                    {payment.pixCopyPaste}
                  </div>
                  <Button
                    variant={copied ? 'dark' : 'primary'}
                    size="lg"
                    block
                    onClick={handleCopyPix}
                    aria-live="polite"
                  >
                    {copied ? (
                      <>
                        <Check aria-hidden className="h-5 w-5" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden className="h-5 w-5" />
                        Copiar código Pix
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Alert tone="warning" title="Código Pix indisponível">
                  Entre em contato pelo WhatsApp informando o pedido <strong className="font-mono">{rental.code}</strong>.
                </Alert>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/65 p-5">
            <div>
              <p className="text-base font-semibold text-white">
                Conclua o pagamento por {PAYMENT_METHOD_LABEL[payment.method].toLowerCase()}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Abra a fatura segura do gateway para finalizar o pagamento de{' '}
                <strong className="text-amber-400 tabular-nums">{formatBRL(rental.totalAmount)}</strong>. Assim que
                confirmado, esta página atualizará automaticamente.
              </p>
            </div>
            {payment.invoiceUrl ? (
              <a
                href={payment.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'primary', size: 'lg', block: true })}
              >
                Abrir fatura de pagamento
                <ExternalLink aria-hidden className="h-5 w-5" />
              </a>
            ) : (
              <Alert tone="info" title="Link de pagamento em processamento">
                Aguarde alguns instantes ou fale com nossa equipe no WhatsApp informando o código{' '}
                <strong className="font-mono">{rental.code}</strong>.
              </Alert>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-slate-300">
          <span className="flex items-center gap-2">
            <RefreshCw
              aria-hidden
              className={`h-4 w-4 text-yellow-400 ${polling ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            <span>
              Aguardando confirmação automática do banco...
              {payment.expiresAt ? (
                <span className="ml-1 text-slate-400">(reserva garantida até {formatDateTime(payment.expiresAt)})</span>
              ) : null}
            </span>
          </span>
          {showOrderPageLink ? (
            <Link
              href={`/pedidos/${encodeURIComponent(rental.id)}`}
              className="inline-flex items-center gap-1 font-semibold text-yellow-400 underline underline-offset-4 hover:text-amber-400"
            >
              Página do pedido <span className="font-mono">({rental.code})</span>
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {SHOW_DEV_SIMULATOR && rental.status === 'PENDING_PAYMENT' ? (
          <div className="rounded-2xl border border-dashed border-yellow-400/45 bg-yellow-400/25 p-4 backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-yellow-400">
                <p className="flex items-center gap-1.5 font-semibold text-white">
                  <FlaskConical aria-hidden className="h-4 w-4 text-yellow-400" />
                  Ambiente de teste / homologação
                </p>
                <p className="mt-0.5 text-slate-300">
                  Dispare o webhook de pagamento aprovado para testar a confirmação instantânea e alocação de ativos.
                </p>
              </div>
              <Button
                variant="dark"
                size="md"
                loading={simulating}
                onClick={handleSimulatePayment}
                className="shrink-0"
              >
                Simular aprovação de pagamento (ambiente de teste)
              </Button>
            </div>
            {simError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-rose-400">
                {simError}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
