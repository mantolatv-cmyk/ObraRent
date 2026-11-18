'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  QrCode,
  Truck,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCepLookup } from '@/hooks/useCepLookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { cn } from '@/lib/cn';
import {
  formatBRL,
  formatCpfOrCnpj,
  formatPeriod,
  FREIGHT_ZONE_LABEL,
  maskCep,
  maskCpfOrCnpj,
  maskPhone,
} from '@/lib/format';
import { UF_LIST } from '@/lib/validation';
import type {
  AddressFormState,
  ClientFormState,
  EstimatedLine,
  Step3Errors,
} from '@/components/checkout/state';
import type { ApiError } from '@/lib/api';
import type { PaymentMethod, Quote } from '@/lib/types';

const PAYMENT_OPTIONS: {
  method: PaymentMethod;
  title: string;
  subtitle: string;
  badge?: string;
  Icon: typeof QrCode;
}[] = [
    {
      method: 'PIX',
      title: 'Pix',
      subtitle: 'QR Code e Pix Copia e Cola · Liberação imediata dos equipamentos',
      badge: 'Aprovação instantânea',
      Icon: QrCode,
    },
    {
      method: 'CREDIT_CARD',
      title: 'Cartão de crédito',
      subtitle: 'Pagamento online via link seguro do gateway',
      Icon: CreditCard,
    },
    {
      method: 'BOLETO',
      title: 'Boleto bancário',
      subtitle: 'Compensação bancária em até 1 dia útil',
      Icon: FileText,
    },
  ];

export interface CompanyDeliveryStepProps {
  client: ClientFormState;
  onPatchClient: (patch: Partial<ClientFormState>) => void;
  address: AddressFormState;
  onPatchAddress: (patch: Partial<AddressFormState>) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  errors: Step3Errors;
  submitError: string | null;
  quote: Quote | null;
  quoteLoading: boolean;
  quoteError: ApiError | null;
  fallbackEstimate: {
    days: number;
    discountPct: number;
    lines: EstimatedLine[];
    subtotal: number;
  };
  startDate: string;
  endDate: string;
  deliveryTimeSlot?: string;
}

export function CompanyDeliveryStep({
  client,
  onPatchClient,
  address,
  onPatchAddress,
  paymentMethod,
  onPaymentMethodChange,
  errors,
  submitError,
  quote,
  quoteLoading,
  quoteError,
  fallbackEstimate,
  startDate,
  endDate,
  deliveryTimeSlot,
}: CompanyDeliveryStepProps) {
  const { user } = useAuth();
  const cnpjLookup = useCnpjLookup(client.cnpj);
  const cepLookup = useCepLookup(address.cep);

  const lastAutofilledCnpj = useRef<string>('');
  const lastAutofilledCep = useRef<string>('');

  // Auto-fill from authenticated user profile
  useEffect(() => {
    if (!user) return;
    if (!client.cnpj) {
      onPatchClient({
        cnpj: maskCpfOrCnpj(user.cnpj),
        companyName: user.companyName,
        tradeName: user.tradeName || '',
        email: user.email || '',
        phone: user.phone ? maskPhone(user.phone) : '',
      });
    }
  }, [user, client.cnpj, onPatchClient]);

  // Auto-fill client fields when CNPJ lookup succeeds
  useEffect(() => {
    if (cnpjLookup.status !== 'success') return;
    if (lastAutofilledCnpj.current === cnpjLookup.cnpj) return;
    lastAutofilledCnpj.current = cnpjLookup.cnpj;

    const { data } = cnpjLookup;
    const patch: Partial<ClientFormState> = {};
    if (data.companyName) patch.companyName = data.companyName;
    if (data.tradeName) patch.tradeName = data.tradeName;
    if (data.email && !client.email) patch.email = data.email;
    if (data.phone && !client.phone) patch.phone = maskPhone(data.phone);
    if (Object.keys(patch).length > 0) {
      onPatchClient(patch);
    }
  }, [cnpjLookup, client.email, client.phone, onPatchClient]);

  // Auto-fill address fields when CEP lookup succeeds
  useEffect(() => {
    if (cepLookup.status !== 'success') return;
    if (lastAutofilledCep.current === cepLookup.cep) return;
    lastAutofilledCep.current = cepLookup.cep;

    const { data } = cepLookup;
    const patch: Partial<AddressFormState> = {};
    if (data.street) patch.street = data.street;
    if (data.district) patch.district = data.district;
    if (data.city) patch.city = data.city;
    if (data.state) patch.state = data.state;
    if (Object.keys(patch).length > 0) {
      onPatchAddress(patch);
    }
  }, [cepLookup, onPatchAddress]);

  return (
    <section aria-labelledby="step3-heading" className="space-y-6">
      <div>
        <h2 id="step3-heading" className="text-xl font-bold text-white">
          3. Cliente, entrega e pagamento
        </h2>
        <p className="mt-1 text-base text-slate-300">
          Informe seu CPF ou CNPJ e o endereço da obra/reforma para entrega.
        </p>
      </div>

      {submitError ? (
        <Alert tone="danger" title="Não foi possível concluir o pedido">
          {submitError}
        </Alert>
      ) : null}

      {/* Client Identification (CPF or CNPJ) */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 aria-hidden className="h-5 w-5 text-yellow-400" />
              Identificação do Cliente (CPF ou CNPJ)
            </span>
          }
          description="Atendimento para Pessoa Física (reformas e projetos) ou Pessoa Jurídica (empresas)."
          action={
            <button
              type="button"
              onClick={() => onPatchClient({ cnpj: maskCpfOrCnpj('11222333000181') })}
              className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-400 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)] transition-all hover:border-yellow-400 hover:bg-yellow-400/20"
            >
              Usar CNPJ Demo
            </button>
          }
        />
        <CardBody className="space-y-4">
          {user ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3.5 py-2.5 text-xs text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.15)]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  Conectado como <strong>{user.companyName}</strong> ({formatCpfOrCnpj(user.cnpj)})
                </span>
              </span>
              <Link href="/login" className="text-yellow-400 underline hover:text-white shrink-0">
                Trocar conta
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-300">
              <span>Já possui uma conta na Mantovani?</span>
              <Link href="/login?redirect=/alugar" className="font-semibold text-yellow-400 hover:underline shrink-0">
                Entrar com senha
              </Link>
            </div>
          )}

          <Field
            label="CPF ou CNPJ"
            error={
              errors.cnpj ??
              (cnpjLookup.status === 'invalid' ? 'Documento inválido. Verifique os dígitos informados.' : null)
            }
            hint="Digite os 11 dígitos do CPF ou 14 dígitos do CNPJ para emissão do contrato."
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              value={client.cnpj}
              onChange={(e) => onPatchClient({ cnpj: maskCpfOrCnpj(e.target.value) })}
              trailing={
                cnpjLookup.status === 'loading' ? (
                  <Loader2 aria-hidden className="h-5 w-5 animate-spin text-yellow-400" />
                ) : cnpjLookup.status === 'success' ? (
                  <CheckCircle2 aria-hidden className="h-5 w-5 text-amber-400" />
                ) : null
              }
            />
          </Field>

          {/* Document Lookup Feedback Card */}
          {cnpjLookup.status === 'success' && cnpjLookup.data.companyName ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/45 bg-amber-400/30 p-4 text-sm text-amber-400 backdrop-blur-md shadow-[0_0_28px_-4px_rgba(250, 204, 21, 0.25)]">
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{cnpjLookup.data.companyName}</p>
                  <Badge tone="success">
                    {cnpjLookup.data.registered ? 'Cliente cadastrado' : 'Documento localizado'}
                  </Badge>
                </div>
                {cnpjLookup.data.tradeName ? (
                  <p className="mt-0.5 text-amber-400/90">Nome fantasia: {cnpjLookup.data.tradeName}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome completo ou Razão social" error={errors.companyName} className="sm:col-span-2">
              <Input
                placeholder="Ex.: João da Silva ou Construtora Horizonte Ltda"
                value={client.companyName}
                onChange={(e) => onPatchClient({ companyName: e.target.value })}
              />
            </Field>

            <Field label="Nome fantasia ou apelido" optional>
              <Input
                placeholder="Ex.: Horizonte Engenharia ou João"
                value={client.tradeName}
                onChange={(e) => onPatchClient({ tradeName: e.target.value })}
              />
            </Field>

            <Field label="WhatsApp para contato" error={errors.phone}>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                value={client.phone}
                onChange={(e) => onPatchClient({ phone: maskPhone(e.target.value) })}
              />
            </Field>

            <Field label="E-mail (contrato e comprovante)" error={errors.email} className="sm:col-span-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
                value={client.email}
                onChange={(e) => onPatchClient({ email: e.target.value })}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Delivery Address Section */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <MapPin aria-hidden className="h-5 w-5 text-yellow-400" />
              Endereço de entrega (obra ou reforma)
            </span>
          }
          description="Informe o CEP do local de entrega para agendamento logístico (frete incluso)."
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="CEP da obra"
              error={errors.cep}
              hint={
                cepLookup.status === 'error'
                  ? 'CEP não localizado automaticamente — preencha o endereço abaixo.'
                  : undefined
              }
            >
              <Input
                inputMode="numeric"
                placeholder="01310-100"
                value={address.cep}
                onChange={(e) => onPatchAddress({ cep: maskCep(e.target.value) })}
                trailing={
                  cepLookup.status === 'loading' ? (
                    <Loader2 aria-hidden className="h-5 w-5 animate-spin text-yellow-400" />
                  ) : cepLookup.status === 'success' ? (
                    <CheckCircle2 aria-hidden className="h-5 w-5 text-amber-400" />
                  ) : null
                }
              />
            </Field>

            <Field label="Logradouro (rua / avenida)" error={errors.street} className="sm:col-span-2">
              <Input
                placeholder="Av. Paulista"
                value={address.street}
                onChange={(e) => onPatchAddress({ street: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Número / lote" error={errors.number}>
              <Input
                placeholder="1000"
                value={address.number}
                onChange={(e) => onPatchAddress({ number: e.target.value })}
              />
            </Field>

            <Field label="Complemento" optional className="sm:col-span-2">
              <Input
                placeholder="Canteiro central, Galpão B"
                value={address.complement}
                onChange={(e) => onPatchAddress({ complement: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <Field label="Bairro" error={errors.district} className="sm:col-span-2">
              <Input
                placeholder="Bela Vista"
                value={address.district}
                onChange={(e) => onPatchAddress({ district: e.target.value })}
              />
            </Field>

            <Field label="Cidade" error={errors.city} className="sm:col-span-3">
              <Input
                placeholder="São Paulo"
                value={address.city}
                onChange={(e) => onPatchAddress({ city: e.target.value })}
              />
            </Field>

            <Field label="UF" error={errors.state} className="sm:col-span-1">
              <Select
                value={address.state}
                onChange={(e) => onPatchAddress({ state: e.target.value })}
              >
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Ponto de referência / instruções de descarga"
            optional
            hint="Ex.: Portão 2 na rua lateral, procurar Mestre João."
          >
            <Input
              placeholder="Portão de carga, horário permitido ou responsável no local"
              value={address.reference}
              onChange={(e) => onPatchAddress({ reference: e.target.value })}
            />
          </Field>

          {deliveryTimeSlot ? (
            <div className="flex items-center gap-3 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm text-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.15)]">
              <Clock aria-hidden="true" className="h-5 w-5 shrink-0 text-yellow-400" />
              <div>
                <p className="font-semibold text-white">Janela de entrega agendada na obra</p>
                <p className="text-yellow-400 font-mono text-sm">{deliveryTimeSlot}</p>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Payment Method Selector */}
      <Card>
        <CardHeader
          title="Forma de pagamento"
          description="A reserva segura os equipamentos por 30 minutos para conclusão do pagamento."
        />
        <CardBody>
          <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-1 gap-3">
            {PAYMENT_OPTIONS.map((opt) => {
              const selected = paymentMethod === opt.method;
              return (
                <button
                  key={opt.method}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPaymentMethodChange(opt.method)}
                  className={cn(
                    'flex min-h-16 w-full items-start gap-3.5 rounded-2xl border p-4 text-left backdrop-blur-md transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400',
                    selected
                      ? 'border-amber-400/60 bg-amber-400/30 ring-1 ring-amber-400/40 shadow-[0_0_26px_-4px_rgba(250, 204, 21, 0.25)]'
                      : 'border-white/10 bg-slate-950/60 hover:border-yellow-400/45 hover:bg-yellow-400/20',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
                      selected
                        ? 'border border-amber-400/50 bg-amber-400/20 text-amber-400 shadow-[0_0_14px_rgba(250, 204, 21, 0.25)]'
                        : 'border border-white/10 bg-slate-900 text-yellow-400',
                    )}
                  >
                    <opt.Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white">{opt.title}</span>
                      {opt.badge ? <Badge tone="accent">{opt.badge}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-300">{opt.subtitle}</p>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      'mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-amber-400 bg-amber-400/20' : 'border-slate-500 bg-slate-950',
                    )}
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Quote / Order Summary Section (inline on Step 3) */}
      <Card className="border-yellow-400/25">
        <CardHeader
          title="Resumo da cotação"
          description={formatPeriod(startDate, endDate)}
          action={
            quoteLoading ? (
              <Badge tone="neutral">
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                Calculando...
              </Badge>
            ) : quote ? (
              <Badge tone="info">{FREIGHT_ZONE_LABEL[quote.freight.zone]}</Badge>
            ) : null
          }
        />
        <CardBody className="space-y-4">
          {quoteError ? (
            <Alert tone="warning" title="Cotação estimada localmente">
              {quoteError.message} O valor exato será confirmado ao gerar o pedido.
            </Alert>
          ) : null}

          <ul className="divide-y divide-white/10 text-sm">
            {(quote
              ? quote.lines
              : fallbackEstimate.lines.map((l) => ({
                categoryId: l.category.id,
                categoryName: l.category.name,
                quantity: l.quantity,
                baseDailyRate: l.baseDailyRate,
                discountPct: l.discountPct,
                agreedDailyRate: l.agreedDailyRate,
                subtotal: l.subtotal,
              }))
            ).map((line) => (
              <li key={line.categoryId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {line.quantity}× {line.categoryName}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                    <span>
                      {formatBRL(line.agreedDailyRate)}/dia × {quote ? quote.days : fallbackEstimate.days}{' '}
                      {(quote ? quote.days : fallbackEstimate.days) === 1 ? 'dia' : 'dias'}
                    </span>
                    {line.discountPct > 0 ? (
                      <Badge tone="success">-{line.discountPct}%</Badge>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-amber-400 tabular-nums">
                  {formatBRL(line.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-white/10 pt-3 text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <dt>Subtotal dos equipamentos</dt>
              <dd className="font-medium text-white tabular-nums">
                {formatBRL(quote ? quote.subtotal : fallbackEstimate.subtotal)}
              </dd>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <dt className="flex items-center gap-1.5">
                <Truck aria-hidden className="h-4 w-4 text-yellow-400" />
                <span>
                  Frete de Entrega{' '}
                  {quote
                    ? `(${FREIGHT_ZONE_LABEL[quote.freight.zone]}${quote.freight.distanceKm != null ? ` · ${quote.freight.distanceKm} km` : ''
                    })`
                    : ''}
                </span>
              </dt>
              <dd className="font-semibold text-emerald-400 tabular-nums">
                Grátis (Incluso)
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <dt>Total das diárias</dt>
              <dd className="text-xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_10px_rgba(250, 204, 21, 0.25)]">
                {formatBRL(quote ? quote.totalAmount : fallbackEstimate.subtotal)}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </section>
  );
}
