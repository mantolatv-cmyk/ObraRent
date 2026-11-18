import type { Queryable } from '../db/pool';
import { toNumber } from '../lib/money';
import type { PaymentMethod, PaymentStatus } from '../types/domain';

export interface PaymentRecord {
  id: string;
  rentalId: string;
  gateway: string;
  gatewayTxId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  pixCopyPaste: string | null;
  invoiceUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  rental_id: string;
  gateway: string;
  gateway_tx_id: string;
  amount: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  pix_copy_paste: string | null;
  invoice_url: string | null;
  expires_at: Date | string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
}

function isoOrNull(val: Date | string | null): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    rentalId: row.rental_id,
    gateway: row.gateway,
    gatewayTxId: row.gateway_tx_id,
    amount: toNumber(row.amount),
    paymentMethod: row.payment_method,
    status: row.status,
    pixCopyPaste: row.pix_copy_paste,
    invoiceUrl: row.invoice_url,
    expiresAt: isoOrNull(row.expires_at),
    paidAt: isoOrNull(row.paid_at),
    createdAt: isoOrNull(row.created_at) ?? new Date().toISOString(),
  };
}

export class PaymentRepository {
  async create(
    db: Queryable,
    input: {
      rentalId: string;
      gateway: string;
      gatewayTxId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      pixCopyPaste?: string | null;
      invoiceUrl?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<PaymentRecord> {
    const res = await db.query<PaymentRow>(
      `
      INSERT INTO payments (
        rental_id, gateway, gateway_tx_id, amount, payment_method, status, pix_copy_paste, invoice_url, expires_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, 'PENDING', $6, $7, $8)
      RETURNING id, rental_id, gateway, gateway_tx_id, amount, payment_method, status, pix_copy_paste, invoice_url, expires_at, paid_at, created_at
      `,
      [
        input.rentalId,
        input.gateway,
        input.gatewayTxId,
        input.amount,
        input.paymentMethod,
        input.pixCopyPaste ?? null,
        input.invoiceUrl ?? null,
        input.expiresAt ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to insert payment record');
    }
    return mapPayment(row);
  }

  async findByGatewayTxId(db: Queryable, gatewayTxId: string): Promise<PaymentRecord | null> {
    const res = await db.query<PaymentRow>(
      `
      SELECT id, rental_id, gateway, gateway_tx_id, amount, payment_method, status, pix_copy_paste, invoice_url, expires_at, paid_at, created_at
      FROM payments
      WHERE gateway_tx_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [gatewayTxId],
    );
    const row = res.rows[0];
    return row ? mapPayment(row) : null;
  }

  async findLatestByRentalId(db: Queryable, rentalId: string): Promise<PaymentRecord | null> {
    const res = await db.query<PaymentRow>(
      `
      SELECT id, rental_id, gateway, gateway_tx_id, amount, payment_method, status, pix_copy_paste, invoice_url, expires_at, paid_at, created_at
      FROM payments
      WHERE rental_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [rentalId],
    );
    const row = res.rows[0];
    return row ? mapPayment(row) : null;
  }

  async updateStatus(
    db: Queryable,
    id: string,
    status: PaymentStatus,
    paidAt?: Date | null,
  ): Promise<PaymentRecord | null> {
    const res = await db.query<PaymentRow>(
      `
      UPDATE payments
      SET status = $2,
          paid_at = COALESCE($3, paid_at)
      WHERE id = $1::uuid
      RETURNING id, rental_id, gateway, gateway_tx_id, amount, payment_method, status, pix_copy_paste, invoice_url, expires_at, paid_at, created_at
      `,
      [id, status, paidAt ?? null],
    );
    const row = res.rows[0];
    return row ? mapPayment(row) : null;
  }

  /** Returns true when this webhook event is new, false if already processed. */
  async recordWebhookEvent(
    db: Queryable,
    event: { gateway: string; eventId: string; eventType: string; payload: unknown },
  ): Promise<boolean> {
    const res = await db.query<{ id: string }>(
      `
      INSERT INTO payment_webhook_events (gateway, event_id, event_type, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (gateway, event_id) DO NOTHING
      RETURNING id
      `,
      [event.gateway, event.eventId, event.eventType, JSON.stringify(event.payload ?? {})],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

export const paymentRepository = new PaymentRepository();
