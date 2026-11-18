import { randomUUID } from 'node:crypto';
import axios from 'axios';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { UnauthorizedError, UpstreamError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { buildPixPayload } from '../lib/pix-brcode';
import type { Client, PaymentMethod } from '../types/domain';

export interface CreateChargeInput {
  rentalId: string;
  rentalCode: string;
  amount: number;
  method: PaymentMethod;
  client: Client;
  expiresAt: Date;
}

export interface ChargeResult {
  gateway: string;
  gatewayTxId: string;
  pixCopyPaste: string | null;
  pixQrCodeImage: string | null;
  invoiceUrl: string | null;
  expiresAt: Date;
}

export interface NormalizedGatewayWebhook {
  gateway: string;
  eventId: string;
  eventType: 'PAID' | 'FAILED' | 'REFUNDED' | 'IGNORED';
  rawEventName: string;
  gatewayTxId: string | null;
  rentalId: string | null;
}

export class PaymentGatewayService {
  async renderQrCodeDataUrl(pixCopyPaste: string | null): Promise<string | null> {
    if (!pixCopyPaste) return null;
    try {
      return await QRCode.toDataURL(pixCopyPaste, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to render Pix QR code PNG');
      return null;
    }
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    if (env.PAYMENT_GATEWAY === 'asaas') {
      return this.createAsaasCharge(input);
    }
    return this.createMockCharge(input);
  }

  private async createMockCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const shortId = randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
    const gatewayTxId = `tx_${shortId.toLowerCase()}`;

    if (input.method === 'PIX') {
      const pixCopyPaste = buildPixPayload({
        pixKey: env.PIX_KEY,
        merchantName: env.PIX_MERCHANT_NAME,
        merchantCity: env.PIX_MERCHANT_CITY,
        amount: input.amount,
        txid: input.rentalCode.replace(/[^A-Za-z0-9]/g, ''),
        description: `Locacao ${input.rentalCode}`,
      });
      const pixQrCodeImage = await this.renderQrCodeDataUrl(pixCopyPaste);
      return {
        gateway: 'mock',
        gatewayTxId,
        pixCopyPaste,
        pixQrCodeImage,
        invoiceUrl: `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/pedidos/${input.rentalId}`,
        expiresAt: input.expiresAt,
      };
    }

    return {
      gateway: 'mock',
      gatewayTxId,
      pixCopyPaste: null,
      pixQrCodeImage: null,
      invoiceUrl: `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/pedidos/${input.rentalId}?checkout=${gatewayTxId}`,
      expiresAt: input.expiresAt,
    };
  }

  private async createAsaasCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const headers = {
      access_token: env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
    };
    const base = env.ASAAS_API_URL.replace(/\/$/, '');

    try {
      // 1. Find or create customer in Asaas by CNPJ
      const customerSearch = await axios.get<{ data?: { id: string }[] }>(`${base}/customers`, {
        params: { cpfCnpj: input.client.cnpj },
        headers,
        timeout: env.HTTP_TIMEOUT_MS,
      });

      let customerId = customerSearch.data.data?.[0]?.id;
      if (!customerId) {
        const created = await axios.post<{ id: string }>(
          `${base}/customers`,
          {
            name: input.client.companyName,
            cpfCnpj: input.client.cnpj,
            email: input.client.email ?? undefined,
            mobilePhone: input.client.phone ?? undefined,
          },
          { headers, timeout: env.HTTP_TIMEOUT_MS },
        );
        customerId = created.data.id;
      }

      // 2. Create payment
      const dueDate = input.expiresAt.toISOString().slice(0, 10);
      const paymentRes = await axios.post<{ id: string; invoiceUrl?: string }>(
        `${base}/payments`,
        {
          customer: customerId,
          billingType: input.method,
          value: input.amount,
          dueDate,
          externalReference: input.rentalId,
          description: `Mantovani - Contrato ${input.rentalCode}`,
        },
        { headers, timeout: env.HTTP_TIMEOUT_MS },
      );

      const gatewayTxId = paymentRes.data.id;
      let pixCopyPaste: string | null = null;
      let pixQrCodeImage: string | null = null;

      if (input.method === 'PIX') {
        const qrRes = await axios.get<{ payload?: string; encodedImage?: string }>(
          `${base}/payments/${gatewayTxId}/pixQrCode`,
          { headers, timeout: env.HTTP_TIMEOUT_MS },
        );
        pixCopyPaste = qrRes.data.payload ?? null;
        pixQrCodeImage = qrRes.data.encodedImage
          ? `data:image/png;base64,${qrRes.data.encodedImage}`
          : await this.renderQrCodeDataUrl(pixCopyPaste);
      }

      return {
        gateway: 'asaas',
        gatewayTxId,
        pixCopyPaste,
        pixQrCodeImage,
        invoiceUrl: paymentRes.data.invoiceUrl ?? null,
        expiresAt: input.expiresAt,
      };
    } catch (err) {
      logger.error({ err, rentalId: input.rentalId }, 'Asaas charge creation failed');
      throw new UpstreamError('gateway de pagamentos (Asaas)', err);
    }
  }

  verifyWebhookAuth(headers: Record<string, string | string[] | undefined>): void {
    const token =
      headers['asaas-access-token'] ??
      headers['x-webhook-token'] ??
      headers['x-gateway-token'];

    const tokenStr = Array.isArray(token) ? token[0] : token;
    if (env.NODE_ENV === 'production') {
      if (!tokenStr || tokenStr !== env.GATEWAY_WEBHOOK_TOKEN) {
        throw new UnauthorizedError('Token de webhook inválido.');
      }
    } else if (tokenStr && tokenStr !== env.GATEWAY_WEBHOOK_TOKEN) {
      throw new UnauthorizedError('Token de webhook inválido.');
    }
  }

  /**
   * Normalises Asaas, Pagar.me and direct gateway webhook payloads into a single
   * canonical structure.
   */
  parseWebhookPayload(raw: unknown): NormalizedGatewayWebhook {
    if (typeof raw !== 'object' || raw === null) {
      throw new ValidationError('Payload de webhook inválido.');
    }
    const body = raw as Record<string, unknown>;

    // 1. Asaas format: { id?, event: "PAYMENT_RECEIVED" | "PAYMENT_CONFIRMED", payment: { id, externalReference } }
    if (typeof body.event === 'string' && typeof body.payment === 'object' && body.payment !== null) {
      const payment = body.payment as Record<string, unknown>;
      const rawEvent = body.event.toUpperCase();
      const gatewayTxId = typeof payment.id === 'string' ? payment.id : null;
      const rentalId = typeof payment.externalReference === 'string' ? payment.externalReference : null;
      const eventId =
        typeof body.id === 'string'
          ? body.id
          : `asaas:${rawEvent}:${gatewayTxId ?? rentalId ?? randomUUID()}`;

      let eventType: NormalizedGatewayWebhook['eventType'] = 'IGNORED';
      if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_APPROVED', 'PAID'].includes(rawEvent)) {
        eventType = 'PAID';
      } else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'FAILED'].includes(rawEvent)) {
        eventType = 'FAILED';
      } else if (['PAYMENT_REFUNDED', 'REFUNDED'].includes(rawEvent)) {
        eventType = 'REFUNDED';
      }

      return {
        gateway: 'asaas',
        eventId,
        eventType,
        rawEventName: rawEvent,
        gatewayTxId,
        rentalId,
      };
    }

    // 2. Pagar.me format: { id?, type: "order.paid" | "charge.paid", data: { id, code?, metadata?: { rentalId? } } }
    if (typeof body.type === 'string' && typeof body.data === 'object' && body.data !== null) {
      const data = body.data as Record<string, unknown>;
      const metadata =
        typeof data.metadata === 'object' && data.metadata !== null
          ? (data.metadata as Record<string, unknown>)
          : {};
      const rawEvent = body.type.toLowerCase();
      const gatewayTxId = typeof data.id === 'string' ? data.id : null;
      const rentalId =
        typeof metadata.rentalId === 'string'
          ? metadata.rentalId
          : typeof data.code === 'string'
            ? data.code
            : null;
      const eventId =
        typeof body.id === 'string'
          ? body.id
          : `pagarme:${rawEvent}:${gatewayTxId ?? rentalId ?? randomUUID()}`;

      let eventType: NormalizedGatewayWebhook['eventType'] = 'IGNORED';
      if (rawEvent === 'order.paid' || rawEvent === 'charge.paid') {
        eventType = 'PAID';
      } else if (rawEvent === 'charge.payment_failed' || rawEvent === 'order.payment_failed') {
        eventType = 'FAILED';
      } else if (rawEvent === 'charge.refunded') {
        eventType = 'REFUNDED';
      }

      return {
        gateway: 'pagarme',
        eventId,
        eventType,
        rawEventName: rawEvent,
        gatewayTxId,
        rentalId,
      };
    }

    // 3. Direct / simplified webhook format: { event/status, gatewayTxId/gateway_tx_id, rentalId/rental_id }
    const rawEvent = String(body.event ?? body.status ?? 'PAID').toUpperCase();
    const gatewayTxId =
      typeof body.gatewayTxId === 'string'
        ? body.gatewayTxId
        : typeof body.gateway_tx_id === 'string'
          ? body.gateway_tx_id
          : null;
    const rentalId =
      typeof body.rentalId === 'string'
        ? body.rentalId
        : typeof body.rental_id === 'string'
          ? body.rental_id
          : null;

    if (!gatewayTxId && !rentalId) {
      throw new ValidationError('Webhook de pagamento deve informar gatewayTxId ou rentalId.');
    }

    let eventType: NormalizedGatewayWebhook['eventType'] = 'IGNORED';
    if (['PAID', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_APPROVED', 'APPROVED', 'CONFIRMED'].includes(rawEvent)) {
      eventType = 'PAID';
    } else if (['FAILED', 'PAYMENT_FAILED', 'DECLINED'].includes(rawEvent)) {
      eventType = 'FAILED';
    } else if (['REFUNDED', 'PAYMENT_REFUNDED'].includes(rawEvent)) {
      eventType = 'REFUNDED';
    }

    const eventId =
      typeof body.eventId === 'string'
        ? body.eventId
        : typeof body.id === 'string'
          ? body.id
          : `direct:${rawEvent}:${gatewayTxId ?? rentalId}`;

    return {
      gateway: typeof body.gateway === 'string' ? body.gateway : 'mock',
      eventId,
      eventType,
      rawEventName: rawEvent,
      gatewayTxId,
      rentalId,
    };
  }
}

export const paymentGatewayService = new PaymentGatewayService();
