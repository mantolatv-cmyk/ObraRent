import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { pool, type Queryable, type TxClient } from '../db/pool';
import { withTransaction } from '../db/transaction';
import { isValidCnpj, normalizeCnpj } from '../lib/cnpj';
import { addDays, formatBrDate, rentalDays } from '../lib/dates';
import {
  InsufficientAvailabilityError,
  InvalidCnpjError,
  InvalidStateTransitionError,
  NotFoundError,
  PG_ERRORS,
  pgErrorCode,
  ValidationError,
  type AvailabilityShortfall,
} from '../lib/errors';
import { logger } from '../lib/logger';
import { formatBRL, round2, toNumber } from '../lib/money';
import { normalizeBrPhone } from '../lib/phone';
import { calculateSlotCapacity, isValidTimeSlot } from '../lib/time-slots';
import { equipmentRepository } from '../repositories/equipment.repository';
import { paymentRepository, type PaymentRecord } from '../repositories/payment.repository';
import { rentalRepository } from '../repositories/rental.repository';
import type {
  ContractDocument,
  DeliveryAddress,
  Freight,
  PaymentInfo,
  PaymentMethod,
  Quote,
  QuoteLine,
  RentalAllocatedItem,
  RentalChannel,
  RentalStatus,
  RentalSummary,
} from '../types/domain';
import { clientService, type ClientOnboardingInput, type CnpjLookupResult } from './client.service';
import { validateRentalPeriod } from './equipment.service';
import { freightService } from './freight.service';
import { paymentGatewayService, type NormalizedGatewayWebhook } from './payment-gateway.service';
import { whatsappProviderService } from './whatsapp-provider.service';

export interface RequestedItemInput {
  categoryId: string;
  quantity: number;
}

export interface QuoteInput {
  startDate: string;
  endDate: string;
  items: RequestedItemInput[];
  deliveryAddress?: Partial<DeliveryAddress>;
  paymentMethod?: PaymentMethod;
}

export interface CreateRentalInput {
  client: ClientOnboardingInput;
  startDate: string;
  endDate: string;
  items: RequestedItemInput[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  channel?: RentalChannel;
  contactPhone?: string;
  deliveryTimeSlot?: string;
}

export const CASH_PAYMENT_DISCOUNT_PCT = 8;

export function calculateDiscountPct(days: number): number {
  if (days >= 30) return 20;
  if (days >= 7) return 10;
  return 0;
}

function consolidateItems(items: RequestedItemInput[]): RequestedItemInput[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError('A quantidade deve ser um inteiro positivo.');
    }
    map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + item.quantity);
  }
  return Array.from(map.entries()).map(([categoryId, quantity]) => ({ categoryId, quantity }));
}

function generateRentalCode(): string {
  const hex = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `LOC-${hex}`;
}

export function buildWarehouseOrderWhatsappText(summary: RentalSummary): string {
  const addr = summary.deliveryAddress;
  const methodLabel =
    summary.payment?.method === 'CASH'
      ? 'Dinheiro na Entrega (8% OFF)'
      : summary.payment?.method === 'PIX'
        ? 'Pix'
        : summary.payment?.method === 'CREDIT_CARD'
          ? 'Cartão de Crédito'
          : 'Boleto Bancário';
  const itemsList = summary.items
    .map((i) => `• 1x *${i.categoryName}* — Patrimônio: *${i.assetTag}* (${formatBRL(i.agreedDailyRate)}/dia)`)
    .join('\n');
  const contractUrl = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/pedidos/${summary.id}/contrato`;

  return [
    `🏭 *ORDEM DE SEPARAÇÃO DE ESTOQUE — MANTOVANI*`,
    `📄 *Contrato Ativo:* *${summary.code}*`,
    `📌 *Status:* ${summary.status === 'CONFIRMED' || summary.status === 'ACTIVE' ? 'LOCAÇÃO ATIVA / SEPARAR IMEDIATAMENTE' : 'PEDIDO REGISTRADO'}`,
    ``,
    `👤 *CLIENTE / LOCATÁRIO:*`,
    `• *Nome/Empresa:* ${summary.client.companyName}`,
    `• *CPF/CNPJ:* ${summary.client.cnpj}`,
    ``,
    `🚜 *EQUIPAMENTOS PARA SEPARAR NO ESTOQUE (${summary.items.length} un.):*`,
    itemsList,
    ``,
    `📅 *PERÍODO & JANELA DE ENTREGA:*`,
    `• *Vigência:* ${formatBrDate(summary.startDate)} a ${formatBrDate(summary.endDate)} (${summary.days} diária(s))`,
    ...(summary.deliveryTimeSlot ? [`• *Horário Agendado:* *${summary.deliveryTimeSlot}*`] : []),
    ``,
    `📍 *ENDEREÇO DE ENTREGA NA OBRA:*`,
    `• ${addr.street}, ${addr.number}${addr.complement ? ` (${addr.complement})` : ''}`,
    `• ${addr.district} — ${addr.city}/${addr.state} — CEP ${addr.cep}`,
    ...(addr.reference ? [`• *Referência:* ${addr.reference}`] : []),
    ``,
    `💰 *FINANCEIRO:*`,
    `• *Forma de Pagamento:* ${methodLabel}`,
    ...(summary.cashDiscountAmount && summary.cashDiscountAmount > 0
      ? [`• *Desconto Dinheiro (8%):* -${formatBRL(summary.cashDiscountAmount)}`]
      : []),
    `• *Valor Total:* *${formatBRL(summary.totalAmount)}*`,
    ``,
    `🔗 *Contrato & Romaneio:* ${contractUrl}`,
  ].join('\n');
}

export function buildWarehouseWhatsappUrl(summary: RentalSummary): string {
  const companyPhone = env.COMPANY_WHATSAPP_NUMBER.replace(/\D/g, '') || '5511999999999';
  const text = buildWarehouseOrderWhatsappText(summary);
  return `https://wa.me/${companyPhone}?text=${encodeURIComponent(text)}`;
}

export class RentalService {
  async quote(input: QuoteInput, db: Queryable = pool): Promise<Quote> {
    const days = validateRentalPeriod(input.startDate, input.endDate);
    const items = consolidateItems(input.items);
    if (items.length === 0) {
      throw new ValidationError('Selecione ao menos um equipamento.');
    }

    const categoriesMap = await equipmentRepository.findCategoriesByIds(
      db,
      items.map((i) => i.categoryId),
    );

    const discountPct = calculateDiscountPct(days);
    const lines: QuoteLine[] = [];
    let totalUnits = 0;

    for (const reqItem of items) {
      const cat = categoriesMap.get(reqItem.categoryId);
      if (!cat) {
        throw new NotFoundError('Categoria de equipamento');
      }
      const agreedDailyRate = round2(cat.baseDailyRate * (1 - discountPct / 100));
      const lineSubtotal = round2(agreedDailyRate * reqItem.quantity * days);
      lines.push({
        categoryId: cat.id,
        categoryName: cat.name,
        quantity: reqItem.quantity,
        baseDailyRate: cat.baseDailyRate,
        discountPct,
        agreedDailyRate,
        subtotal: lineSubtotal,
      });
      totalUnits += reqItem.quantity;
    }

    const subtotal = round2(lines.reduce((acc, l) => acc + l.subtotal, 0));
    const freight = freightService.calculate(input.deliveryAddress, totalUnits);
    const isCash = input.paymentMethod === 'CASH';
    const cashDiscountPct = isCash ? CASH_PAYMENT_DISCOUNT_PCT : 0;
    const cashDiscountAmount = isCash ? round2(subtotal * (CASH_PAYMENT_DISCOUNT_PCT / 100)) : 0;
    const totalAmount = round2(subtotal - cashDiscountAmount);

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      lines,
      subtotal,
      cashDiscountPct,
      cashDiscountAmount,
      freight,
      totalAmount,
    };
  }

  /**
   * Transactional rental creation:
   *  1. Validates or auto-registers the client by CNPJ.
   *  2. Opens a database transaction (`BEGIN`).
   *  3. Dynamically allocates available physical assets (`equipment_items`) under
   *     per-category advisory locks + `FOR UPDATE`.
   *  4. Calculates total amount + dynamic freight.
   *  5. Inserts `rentals` and `rental_items` records.
   *  6. Generates Pix charge payload (or credit card / boleto pending payment).
   *  7. Commits transaction and returns `RentalSummary`.
   */
  async createRental(input: CreateRentalInput): Promise<RentalSummary> {
    const days = validateRentalPeriod(input.startDate, input.endDate);
    const consolidated = consolidateItems(input.items);
    if (consolidated.length === 0) {
      throw new ValidationError('Selecione ao menos um equipamento.');
    }

    const sortedItems = [...consolidated].sort((a, b) => a.categoryId.localeCompare(b.categoryId));

    try {
      return await withTransaction(async (tx) => {
        const client = await clientService.ensureClient(input.client, tx);

        const categoriesMap = await equipmentRepository.findCategoriesByIds(
          tx,
          sortedItems.map((i) => i.categoryId),
        );
        for (const reqItem of sortedItems) {
          if (!categoriesMap.has(reqItem.categoryId)) {
            throw new NotFoundError('Categoria de equipamento');
          }
        }

        const discountPct = calculateDiscountPct(days);
        const shortfalls: AvailabilityShortfall[] = [];
        const allocations: {
          equipmentItemId: string;
          assetTag: string;
          categoryId: string;
          categoryName: string;
          agreedDailyRate: number;
        }[] = [];
        const lines: QuoteLine[] = [];
        let totalUnits = 0;

        for (const reqItem of sortedItems) {
          const cat = categoriesMap.get(reqItem.categoryId)!;
          const available = await equipmentRepository.lockAndSelectAvailableItems(tx, {
            categoryId: cat.id,
            startDate: input.startDate,
            endDate: input.endDate,
            limit: reqItem.quantity,
          });

          if (available.length < reqItem.quantity) {
            shortfalls.push({
              categoryId: cat.id,
              categoryName: cat.name,
              requested: reqItem.quantity,
              available: available.length,
            });
            continue;
          }

          const agreedDailyRate = round2(cat.baseDailyRate * (1 - discountPct / 100));
          const lineSubtotal = round2(agreedDailyRate * reqItem.quantity * days);
          lines.push({
            categoryId: cat.id,
            categoryName: cat.name,
            quantity: reqItem.quantity,
            baseDailyRate: cat.baseDailyRate,
            discountPct,
            agreedDailyRate,
            subtotal: lineSubtotal,
          });
          totalUnits += reqItem.quantity;

          for (const unit of available) {
            allocations.push({
              equipmentItemId: unit.id,
              assetTag: unit.assetTag,
              categoryId: cat.id,
              categoryName: cat.name,
              agreedDailyRate,
            });
          }
        }

        if (shortfalls.length > 0) {
          throw new InsufficientAvailabilityError(shortfalls);
        }

        const subtotal = round2(lines.reduce((acc, l) => acc + l.subtotal, 0));
        const freight = freightService.calculate(input.deliveryAddress, totalUnits);
        const isCash = input.paymentMethod === 'CASH';
        const cashDiscountPct = isCash ? CASH_PAYMENT_DISCOUNT_PCT : 0;
        const cashDiscountAmount = isCash ? round2(subtotal * (CASH_PAYMENT_DISCOUNT_PCT / 100)) : 0;
        const totalAmount = round2(subtotal - cashDiscountAmount);

        const code = generateRentalCode();
        const paymentDueAt = new Date(Date.now() + env.PAYMENT_HOLD_MINUTES * 60_000);

        const contactPhone = input.contactPhone
          ? normalizeBrPhone(input.contactPhone)
          : client.phone;

        if (input.deliveryTimeSlot) {
          if (!isValidTimeSlot(input.deliveryTimeSlot)) {
            throw new ValidationError('Horário de entrega inválido. Selecione um dos horários disponíveis.', [
              { path: 'deliveryTimeSlot', message: 'Horário inválido' },
            ]);
          }

          for (const item of sortedItems) {
            const cat = categoriesMap.get(item.categoryId);
            if (cat) {
              const capacity = calculateSlotCapacity(cat.operationalUnits);
              const bookedRes = await tx.query<{ count: string }>(
                `
                SELECT COUNT(ri.id)::int AS count
                FROM rentals r
                JOIN rental_items ri ON ri.rental_id = r.id
                WHERE r.start_date = $1::date
                  AND r.delivery_time_slot = $2
                  AND r.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE')
                  AND (r.status <> 'PENDING_PAYMENT' OR r.payment_due_at IS NULL OR r.payment_due_at > now())
                  AND ri.blocks_inventory = TRUE
                  AND ri.category_id = $3::uuid
                `,
                [input.startDate, input.deliveryTimeSlot, item.categoryId],
              );
              const booked = Number(bookedRes.rows[0]?.count ?? 0);
              if (booked + item.quantity > capacity) {
                throw new ValidationError(
                  `O horário ${input.deliveryTimeSlot} já está esgotado para o equipamento "${cat.name}". Por favor, selecione outro horário de entrega.`,
                  [{ path: 'deliveryTimeSlot', message: `Esgotado para ${cat.name}` }],
                );
              }
            }
          }
        }

        const header = await rentalRepository.createHeader(tx, {
          code,
          clientId: client.id,
          startDate: input.startDate,
          endDate: input.endDate,
          subtotalAmount: subtotal,
          freightAmount: freight.amount,
          totalAmount,
          channel: input.channel ?? 'WEB',
          deliveryAddress: input.deliveryAddress,
          freightDetails: freight,
          contactPhone,
          paymentDueAt,
          deliveryTimeSlot: input.deliveryTimeSlot ?? null,
        });

        await rentalRepository.insertItems(tx, {
          rentalId: header.id,
          startDate: input.startDate,
          endDate: input.endDate,
          items: allocations.map((a) => ({
            equipmentItemId: a.equipmentItemId,
            categoryId: a.categoryId,
            agreedDailyRate: a.agreedDailyRate,
          })),
        });

        const charge = await paymentGatewayService.createCharge({
          rentalId: header.id,
          rentalCode: code,
          amount: totalAmount,
          method: input.paymentMethod,
          client,
          expiresAt: paymentDueAt,
        });

        const paymentRecord = await paymentRepository.create(tx, {
          rentalId: header.id,
          gateway: charge.gateway,
          gatewayTxId: charge.gatewayTxId,
          amount: totalAmount,
          paymentMethod: input.paymentMethod,
          pixCopyPaste: charge.pixCopyPaste,
          invoiceUrl: charge.invoiceUrl,
          expiresAt: charge.expiresAt,
        });

        const allocatedItems: RentalAllocatedItem[] = allocations.map((a) => ({
          id: a.equipmentItemId,
          categoryId: a.categoryId,
          categoryName: a.categoryName,
          assetTag: a.assetTag,
          agreedDailyRate: a.agreedDailyRate,
        }));

        const paymentInfo: PaymentInfo = {
          id: paymentRecord.id,
          method: paymentRecord.paymentMethod,
          status: paymentRecord.status,
          amount: paymentRecord.amount,
          gatewayTxId: paymentRecord.gatewayTxId,
          pixCopyPaste: paymentRecord.pixCopyPaste,
          pixQrCodeImage: charge.pixQrCodeImage,
          pixKey: paymentRecord.paymentMethod === 'PIX' ? env.PIX_KEY : null,
          pixMerchantName: paymentRecord.paymentMethod === 'PIX' ? env.PIX_MERCHANT_NAME : null,
          pixMerchantCity: paymentRecord.paymentMethod === 'PIX' ? env.PIX_MERCHANT_CITY : null,
          invoiceUrl: paymentRecord.invoiceUrl,
          expiresAt: paymentRecord.expiresAt,
          paidAt: paymentRecord.paidAt,
        };

        const createdSummary: RentalSummary = {
          id: header.id,
          code,
          status: 'PENDING_PAYMENT',
          channel: input.channel ?? 'WEB',
          startDate: input.startDate,
          endDate: input.endDate,
          days,
          lines,
          subtotal,
          cashDiscountPct,
          cashDiscountAmount,
          freight,
          totalAmount,
          client: {
            id: client.id,
            cnpj: client.cnpj,
            companyName: client.companyName,
            tradeName: client.tradeName,
          },
          deliveryAddress: input.deliveryAddress,
          items: allocatedItems,
          payment: paymentInfo,
          deliveryTimeSlot: input.deliveryTimeSlot ?? null,
          createdAt: header.createdAt,
        };
        createdSummary.warehouseWhatsappUrl = buildWarehouseWhatsappUrl(createdSummary);
        return createdSummary;
      });
    } catch (err) {
      if (pgErrorCode(err) === PG_ERRORS.EXCLUSION_VIOLATION) {
        throw new InsufficientAvailabilityError([
          {
            categoryId: sortedItems[0]?.categoryId ?? '',
            categoryName: 'Equipamento selecionado',
            requested: sortedItems[0]?.quantity ?? 1,
            available: 0,
          },
        ]);
      }
      throw err;
    }
  }

  async getRentalById(rentalId: string, db: Queryable = pool): Promise<RentalSummary> {
    const header = await rentalRepository.findHeaderById(db, rentalId);
    if (!header) {
      throw new NotFoundError('Contrato de locação');
    }

    const itemRows = await rentalRepository.listItemsByRentalId(db, rentalId);
    const payment = await paymentRepository.findLatestByRentalId(db, rentalId);
    return this.assembleSummary(header, itemRows, payment);
  }

  async listRentals(
    params: { status?: RentalStatus; cnpj?: string; limit?: number } = {},
    db: Queryable = pool,
  ): Promise<{ rentals: RentalSummary[]; countsByStatus: Record<RentalStatus, number> }> {
    const cleanCnpj = params.cnpj ? normalizeCnpj(params.cnpj) : undefined;
    const { ids, countsByStatus } = await rentalRepository.listRentalIds(db, {
      status: params.status,
      cnpj: cleanCnpj,
      limit: params.limit,
    });

    const rentals: RentalSummary[] = [];
    for (const id of ids) {
      rentals.push(await this.getRentalById(id, db));
    }

    return { rentals, countsByStatus };
  }

  async listRentalsByCnpj(
    rawCnpj: string,
    db: Queryable = pool,
  ): Promise<{ client: CnpjLookupResult; rentals: RentalSummary[] }> {
    const cnpj = normalizeCnpj(rawCnpj);
    if (!isValidCnpj(cnpj)) {
      throw new InvalidCnpjError('CNPJ inválido. Verifique os 14 dígitos.');
    }
    const client = await clientService.lookupCnpj(cnpj, db);
    const { rentals } = await this.listRentals({ cnpj, limit: 50 }, db);
    return { client, rentals };
  }

  async getContractDocument(rentalId: string, db: Queryable = pool): Promise<ContractDocument> {
    const header = await rentalRepository.findHeaderById(db, rentalId);
    if (!header) {
      throw new NotFoundError('Contrato de locação');
    }
    const itemRows = await rentalRepository.listItemsByRentalId(db, rentalId);
    const payment = await paymentRepository.findLatestByRentalId(db, rentalId);
    const rental = await this.assembleSummary(header, itemRows, payment);

    const assets = itemRows.map((row) => ({
      id: row.equipment_item_id,
      assetTag: row.asset_tag,
      serialNumber: row.serial_number,
      categoryId: row.category_id,
      categoryName: row.category_name,
      agreedDailyRate: toNumber(row.agreed_daily_rate),
      replacementCost: toNumber(row.replacement_cost),
    }));

    const totalReplacementValue = round2(assets.reduce((acc, a) => acc + a.replacementCost, 0));

    return {
      rental,
      issuedAt: new Date().toISOString(),
      documentNumber: `CTR-${header.code.replace('LOC-', '')}-${header.start_date.slice(0, 4)}`,
      lessor: {
        companyName: 'Máquinas para Concreto Atibaiense Ltda',
        tradeName: 'Mantovani',
        cnpj: '52.342.052/0001-40',
        address: 'Rua Bragança Paulista, 132 — Centro, Atibaia/SP — CEP 12944-430',
        phone: '+55 (11) 99999-9999',
        email: 'contratos@mantovani.com.br',
      },
      lessee: {
        id: header.client_id,
        cnpj: header.client_cnpj.trim(),
        companyName: header.client_company_name,
        tradeName: header.client_trade_name,
        email: header.client_email,
        phone: header.client_phone,
      },
      assets,
      totalReplacementValue,
    };
  }

  async extendRental(rentalId: string, additionalDays: number): Promise<RentalSummary> {
    if (!Number.isInteger(additionalDays) || additionalDays < 1 || additionalDays > 90) {
      throw new ValidationError('Informe uma prorrogação entre 1 e 90 dias.', [
        { path: 'additionalDays', message: 'Deve ser entre 1 e 90 dias' },
      ]);
    }

    try {
      return await withTransaction(async (tx) => {
        const header = await rentalRepository.findHeaderById(tx, rentalId, true);
        if (!header) {
          throw new NotFoundError('Contrato de locação');
        }
        if (header.status !== 'CONFIRMED' && header.status !== 'ACTIVE') {
          throw new InvalidStateTransitionError(
            'Prorrogação de contrato',
            header.status,
            'EXTENDED (requer CONFIRMED ou ACTIVE)',
          );
        }

        const newEndDate = addDays(header.end_date, additionalDays);
        const newDays = validateRentalPeriod(header.start_date, newEndDate);

        const itemRows = await rentalRepository.listItemsByRentalId(tx, rentalId);
        const newSubtotal = round2(
          itemRows.reduce((acc, row) => acc + toNumber(row.agreed_daily_rate) * newDays, 0),
        );
        const hadCashDiscount = toNumber(header.total_amount) < toNumber(header.subtotal_amount);
        const cashDiscountAmount = hadCashDiscount
          ? round2(newSubtotal * (CASH_PAYMENT_DISCOUNT_PCT / 100))
          : 0;
        const newTotal = round2(newSubtotal - cashDiscountAmount + toNumber(header.freight_amount));

        await rentalRepository.extendPeriod(tx, {
          rentalId,
          startDate: header.start_date,
          newEndDate,
          newSubtotal,
          newTotal,
        });

        return this.getRentalById(rentalId, tx);
      });
    } catch (err) {
      if (pgErrorCode(err) === PG_ERRORS.EXCLUSION_VIOLATION) {
        throw new InsufficientAvailabilityError([
          {
            categoryId: '',
            categoryName: 'Equipamentos deste contrato já possuem reserva futura no período solicitado',
            requested: 1,
            available: 0,
          },
        ]);
      }
      throw err;
    }
  }

  private async assembleSummary(
    header: NonNullable<Awaited<ReturnType<typeof rentalRepository.findHeaderById>>>,
    itemRows: Awaited<ReturnType<typeof rentalRepository.listItemsByRentalId>>,
    paymentRecord: PaymentRecord | null,
  ): Promise<RentalSummary> {
    const days = rentalDays(header.start_date, header.end_date);
    const { lines, allocatedItems } = rentalRepository.buildLinesAndAllocatedItems(itemRows, days);

    const freightAmount = toNumber(header.freight_amount);
    const freight: Freight = {
      amount: freightAmount,
      distanceKm:
        typeof header.freight_details?.distanceKm === 'number'
          ? header.freight_details.distanceKm
          : null,
      zone: header.freight_details?.zone ?? 'URBAN',
    };

    let payment: PaymentInfo | null = null;
    if (paymentRecord) {
      const pixQrCodeImage =
        paymentRecord.status === 'PENDING' && paymentRecord.pixCopyPaste
          ? await paymentGatewayService.renderQrCodeDataUrl(paymentRecord.pixCopyPaste)
          : null;

      payment = {
        id: paymentRecord.id,
        method: paymentRecord.paymentMethod,
        status: paymentRecord.status,
        amount: paymentRecord.amount,
        gatewayTxId: paymentRecord.gatewayTxId,
        pixCopyPaste: paymentRecord.pixCopyPaste,
        pixQrCodeImage,
        pixKey: paymentRecord.paymentMethod === 'PIX' ? env.PIX_KEY : null,
        pixMerchantName: paymentRecord.paymentMethod === 'PIX' ? env.PIX_MERCHANT_NAME : null,
        pixMerchantCity: paymentRecord.paymentMethod === 'PIX' ? env.PIX_MERCHANT_CITY : null,
        invoiceUrl: paymentRecord.invoiceUrl,
        expiresAt: paymentRecord.expiresAt,
        paidAt: paymentRecord.paidAt,
      };
    }

    const subtotalVal = toNumber(header.subtotal_amount);
    const totalVal = toNumber(header.total_amount);
    const isCashPayment = paymentRecord?.paymentMethod === 'CASH' || totalVal < subtotalVal;
    const cashDiscountAmount = isCashPayment && subtotalVal > totalVal ? round2(subtotalVal - totalVal) : 0;
    const cashDiscountPct = cashDiscountAmount > 0 ? CASH_PAYMENT_DISCOUNT_PCT : 0;

    const summaryObj: RentalSummary = {
      id: header.id,
      code: header.code,
      status: header.status,
      channel: header.channel,
      startDate: header.start_date,
      endDate: header.end_date,
      days,
      lines,
      subtotal: subtotalVal,
      cashDiscountPct,
      cashDiscountAmount,
      freight,
      totalAmount: totalVal,
      client: {
        id: header.client_id,
        cnpj: header.client_cnpj.trim(),
        companyName: header.client_company_name,
        tradeName: header.client_trade_name,
      },
      deliveryAddress: header.delivery_address,
      items: allocatedItems,
      payment,
      deliveryTimeSlot: header.delivery_time_slot ?? null,
      createdAt:
        header.created_at instanceof Date
          ? header.created_at.toISOString()
          : new Date(header.created_at).toISOString(),
    };
    summaryObj.warehouseWhatsappUrl = buildWarehouseWhatsappUrl(summaryObj);
    return summaryObj;
  }

  /**
   * Handles payment gateway webhooks:
   *  - Deduplicates via `payment_webhook_events`.
   *  - Updates `payments.status` to `PAID` (or `FAILED`/`REFUNDED`).
   *  - Updates `rentals.status` to `CONFIRMED` and assigns physical assets.
   *  - Triggers automated WhatsApp confirmation message to the contractor.
   */
  async handleGatewayWebhook(
    rawPayload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ processed: boolean; duplicate?: boolean; rental?: RentalSummary }> {
    paymentGatewayService.verifyWebhookAuth(headers);
    const normalized = paymentGatewayService.parseWebhookPayload(rawPayload);
    return this.applyPaymentEvent(normalized, rawPayload);
  }

  async simulatePaymentApproval(rentalId: string): Promise<RentalSummary> {
    const latest = await paymentRepository.findLatestByRentalId(pool, rentalId);
    if (!latest) {
      throw new NotFoundError('Pagamento da locação');
    }
    const result = await this.applyPaymentEvent(
      {
        gateway: latest.gateway,
        eventId: `sim:${latest.gatewayTxId}:${Date.now()}`,
        eventType: 'PAID',
        rawEventName: 'SIMULATED_PAYMENT_APPROVED',
        gatewayTxId: latest.gatewayTxId,
        rentalId,
      },
      { simulated: true, rentalId },
    );
    if (!result.rental) {
      return this.getRentalById(rentalId);
    }
    return result.rental;
  }

  private async applyPaymentEvent(
    event: NormalizedGatewayWebhook,
    rawPayload: unknown,
  ): Promise<{ processed: boolean; duplicate?: boolean; rental?: RentalSummary }> {
    if (event.eventType === 'IGNORED') {
      return { processed: false };
    }

    let notifyTarget: { phone: string | null; summary: RentalSummary } | null = null;

    const outcome = await withTransaction(async (tx: TxClient) => {
      const isNewEvent = await paymentRepository.recordWebhookEvent(tx, {
        gateway: event.gateway,
        eventId: event.eventId,
        eventType: event.rawEventName,
        payload: rawPayload,
      });
      if (!isNewEvent) {
        return { processed: false, duplicate: true as const };
      }

      let payment = event.gatewayTxId
        ? await paymentRepository.findByGatewayTxId(tx, event.gatewayTxId)
        : null;
      if (!payment && event.rentalId) {
        payment = await paymentRepository.findLatestByRentalId(tx, event.rentalId);
      }
      if (!payment) {
        throw new NotFoundError('Pagamento');
      }

      const header = await rentalRepository.findHeaderById(tx, payment.rentalId, true);
      if (!header) {
        throw new NotFoundError('Contrato de locação');
      }

      if (event.eventType === 'PAID') {
        const wasAlreadyConfirmed = header.status === 'CONFIRMED' || header.status === 'ACTIVE';
        const updatedPayment = await paymentRepository.updateStatus(tx, payment.id, 'PAID', new Date());

        if (header.status === 'PENDING_PAYMENT') {
          await rentalRepository.confirmAndAssignAssets(tx, header.id);
        }

        const refreshedHeader = await rentalRepository.findHeaderById(tx, header.id);
        const itemRows = await rentalRepository.listItemsByRentalId(tx, header.id);
        const summary = await this.assembleSummary(refreshedHeader!, itemRows, updatedPayment);

        const contractorPhone = header.contact_phone ?? header.client_phone;
        if (!wasAlreadyConfirmed) {
          notifyTarget = { phone: contractorPhone ?? null, summary };
        }

        return { processed: true, rental: summary };
      }

      if (event.eventType === 'FAILED') {
        const updatedPayment = await paymentRepository.updateStatus(tx, payment.id, 'FAILED');
        if (header.status === 'PENDING_PAYMENT') {
          await rentalRepository.markCancelled(tx, header.id, 'PAYMENT_FAILED');
        }
        const refreshedHeader = await rentalRepository.findHeaderById(tx, header.id);
        const itemRows = await rentalRepository.listItemsByRentalId(tx, header.id);
        const summary = await this.assembleSummary(refreshedHeader!, itemRows, updatedPayment);
        return { processed: true, rental: summary };
      }

      if (event.eventType === 'REFUNDED') {
        const updatedPayment = await paymentRepository.updateStatus(tx, payment.id, 'REFUNDED');
        if (header.status === 'PENDING_PAYMENT' || header.status === 'CONFIRMED') {
          await rentalRepository.markCancelled(tx, header.id, 'PAYMENT_REFUNDED');
        }
        const refreshedHeader = await rentalRepository.findHeaderById(tx, header.id);
        const itemRows = await rentalRepository.listItemsByRentalId(tx, header.id);
        const summary = await this.assembleSummary(refreshedHeader!, itemRows, updatedPayment);
        return { processed: true, rental: summary };
      }

      return { processed: false };
    });

    if (notifyTarget) {
      const { phone, summary } = notifyTarget as { phone: string | null; summary: RentalSummary };
      const assetList = summary.items.map((i) => `• ${i.categoryName} — Patrimônio *${i.assetTag}*`).join('\n');
      const addr = summary.deliveryAddress;

      // 1. Envia confirmação para o cliente / locatário
      if (phone) {
        const confirmationText = [
          `✅ *Pagamento confirmado! Contrato ${summary.code}*`,
          ``,
          `Olá, *${summary.client.companyName}*! Seu pedido foi aprovado e os equipamentos físicos já estão reservados para sua obra:`,
          assetList,
          ``,
          `📅 *Período:* ${formatBrDate(summary.startDate)} a ${formatBrDate(summary.endDate)} (${summary.days} dia(s))`,
          `📍 *Entrega:* ${addr.street}, ${addr.number} — ${addr.district}, ${addr.city}/${addr.state} (CEP ${addr.cep})`,
          `💰 *Total pago:* ${formatBRL(summary.totalAmount)}`,
          ``,
          `Nossa logística já iniciou a separação para despacho. Acompanhe em: ${env.PUBLIC_APP_URL.replace(/\/$/, '')}/pedidos/${summary.id}`,
        ].join('\n');

        try {
          await whatsappProviderService.sendText(phone, confirmationText);
        } catch (err) {
          logger.error({ err, rentalId: summary.id, phone }, 'Failed to send WhatsApp confirmation notification');
        }
      }

      // 2. Dispara a Ordem de Separação de Estoque para o WhatsApp da empresa
      const companyPhone = env.COMPANY_WHATSAPP_NUMBER.replace(/\D/g, '') || '5511999999999';
      const warehouseText = buildWarehouseOrderWhatsappText(summary);
      try {
        await whatsappProviderService.sendText(companyPhone, warehouseText);
        summary.warehouseNotifiedAt = new Date().toISOString();
      } catch (err) {
        logger.error({ err, rentalId: summary.id, companyPhone }, 'Failed to send WhatsApp warehouse separation order');
      }
    }

    return outcome;
  }

  async activateAndNotifyWarehouse(rentalId: string, customCompanyPhone?: string): Promise<RentalSummary> {
    let summary = await this.getRentalById(rentalId);
    if (summary.status === 'PENDING_PAYMENT') {
      summary = await this.simulatePaymentApproval(rentalId);
    } else {
      const companyPhone = (customCompanyPhone || env.COMPANY_WHATSAPP_NUMBER).replace(/\D/g, '') || '5511999999999';
      const warehouseText = buildWarehouseOrderWhatsappText(summary);
      try {
        await whatsappProviderService.sendText(companyPhone, warehouseText);
      } catch (err) {
        logger.error({ err, rentalId: summary.id, companyPhone }, 'Failed to send WhatsApp warehouse order');
      }
    }
    const targetPhone = (customCompanyPhone || env.COMPANY_WHATSAPP_NUMBER).replace(/\D/g, '') || '5511999999999';
    summary.warehouseWhatsappUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(buildWarehouseOrderWhatsappText(summary))}`;
    summary.warehouseNotifiedAt = new Date().toISOString();
    return summary;
  }

  async cancelRental(rentalId: string): Promise<RentalSummary> {
    return withTransaction(async (tx) => {
      const header = await rentalRepository.findHeaderById(tx, rentalId, true);
      if (!header) throw new NotFoundError('Contrato de locação');
      if (header.status === 'CANCELLED') {
        return this.getRentalById(rentalId, tx);
      }
      if (header.status === 'ACTIVE' || header.status === 'COMPLETED') {
        throw new InvalidStateTransitionError('Contrato', header.status, 'CANCELLED');
      }
      await rentalRepository.markCancelled(tx, rentalId, 'CLIENT_CANCELLED');
      return this.getRentalById(rentalId, tx);
    });
  }

  async dispatchRental(rentalId: string): Promise<RentalSummary> {
    return withTransaction(async (tx) => {
      const header = await rentalRepository.findHeaderById(tx, rentalId, true);
      if (!header) throw new NotFoundError('Contrato de locação');
      if (header.status !== 'CONFIRMED') {
        throw new InvalidStateTransitionError('Contrato', header.status, 'ACTIVE');
      }
      await rentalRepository.markDispatched(tx, rentalId);
      return this.getRentalById(rentalId, tx);
    });
  }

  async returnRental(rentalId: string, maintenanceAssetTags: string[] = []): Promise<RentalSummary> {
    return withTransaction(async (tx) => {
      const header = await rentalRepository.findHeaderById(tx, rentalId, true);
      if (!header) throw new NotFoundError('Contrato de locação');
      if (header.status !== 'ACTIVE' && header.status !== 'CONFIRMED') {
        throw new InvalidStateTransitionError('Contrato', header.status, 'COMPLETED');
      }
      await rentalRepository.markReturned(tx, rentalId, maintenanceAssetTags);
      return this.getRentalById(rentalId, tx);
    });
  }
}

export const rentalService = new RentalService();
