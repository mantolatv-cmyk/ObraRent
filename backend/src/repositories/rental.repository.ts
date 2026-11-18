import type { Queryable, TxClient } from '../db/pool';
import { round2, toNumber } from '../lib/money';
import type {
  DeliveryAddress,
  Freight,
  QuoteLine,
  RentalAllocatedItem,
  RentalChannel,
  RentalStatus,
} from '../types/domain';

export interface RentalHeaderRow {
  id: string;
  code: string;
  client_id: string;
  client_cnpj: string;
  client_company_name: string;
  client_trade_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  start_date: string;
  end_date: string;
  subtotal_amount: string;
  freight_amount: string;
  total_amount: string;
  status: RentalStatus;
  channel: RentalChannel;
  delivery_address: DeliveryAddress;
  freight_details: Partial<Freight>;
  contact_phone: string | null;
  payment_due_at: Date | string | null;
  delivery_time_slot?: string | null;
  created_at: Date | string;
}

export interface RentalItemJoinedRow {
  id: string;
  category_id: string;
  category_name: string;
  base_daily_rate: string;
  replacement_cost: string;
  equipment_item_id: string;
  asset_tag: string;
  serial_number: string | null;
  agreed_daily_rate: string;
}

export class RentalRepository {
  async createHeader(
    tx: TxClient,
    input: {
      code: string;
      clientId: string;
      startDate: string;
      endDate: string;
      subtotalAmount: number;
      freightAmount: number;
      totalAmount: number;
      channel: RentalChannel;
      deliveryAddress: DeliveryAddress;
      freightDetails: Freight;
      contactPhone?: string | null;
      paymentDueAt: Date | null;
      deliveryTimeSlot?: string | null;
    },
  ): Promise<{ id: string; createdAt: string }> {
    const res = await tx.query<{ id: string; created_at: Date | string }>(
      `
      INSERT INTO rentals (
        code, client_id, start_date, end_date,
        subtotal_amount, freight_amount, total_amount,
        status, channel, delivery_address, freight_details,
        contact_phone, payment_due_at, delivery_time_slot
      )
      VALUES (
        $1, $2::uuid, $3::date, $4::date,
        $5, $6, $7,
        'PENDING_PAYMENT', $8, $9::jsonb, $10::jsonb,
        $11, $12, $13
      )
      RETURNING id, created_at
      `,
      [
        input.code,
        input.clientId,
        input.startDate,
        input.endDate,
        input.subtotalAmount,
        input.freightAmount,
        input.totalAmount,
        input.channel,
        JSON.stringify(input.deliveryAddress),
        JSON.stringify(input.freightDetails),
        input.contactPhone ?? null,
        input.paymentDueAt,
        input.deliveryTimeSlot ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to create rental header');
    }
    return {
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    };
  }

  async insertItems(
    tx: TxClient,
    params: {
      rentalId: string;
      startDate: string;
      endDate: string;
      items: { equipmentItemId: string; categoryId: string; agreedDailyRate: number }[];
    },
  ): Promise<void> {
    for (const item of params.items) {
      await tx.query(
        `
        INSERT INTO rental_items (
          rental_id, equipment_item_id, category_id, agreed_daily_rate, rental_period, blocks_inventory
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, daterange($5::date, $6::date, '[]'), TRUE
        )
        `,
        [
          params.rentalId,
          item.equipmentItemId,
          item.categoryId,
          item.agreedDailyRate,
          params.startDate,
          params.endDate,
        ],
      );
    }
  }

  async findHeaderById(db: Queryable, rentalId: string, forUpdate = false): Promise<RentalHeaderRow | null> {
    const lockClause = forUpdate ? 'FOR UPDATE OF r' : '';
    const res = await db.query<RentalHeaderRow>(
      `
      SELECT
        r.id,
        r.code,
        r.client_id,
        c.cnpj AS client_cnpj,
        c.company_name AS client_company_name,
        c.trade_name AS client_trade_name,
        c.email AS client_email,
        c.phone AS client_phone,
        r.start_date,
        r.end_date,
        r.subtotal_amount,
        r.freight_amount,
        r.total_amount,
        r.status,
        r.channel,
        r.delivery_address,
        r.freight_details,
        r.contact_phone,
        r.payment_due_at,
        r.delivery_time_slot,
        r.created_at
      FROM rentals r
      JOIN clients c ON c.id = r.client_id
      WHERE r.id = $1::uuid
      ${lockClause}
      `,
      [rentalId],
    );
    return res.rows[0] ?? null;
  }

  async listRentalIds(
    db: Queryable,
    params: { status?: RentalStatus; cnpj?: string; limit?: number } = {},
  ): Promise<{ ids: string[]; countsByStatus: Record<RentalStatus, number> }> {
    const countsRes = await db.query<{ status: RentalStatus; cnt: string }>(
      `
      SELECT status, COUNT(*)::int AS cnt
      FROM rentals
      GROUP BY status
      `,
    );
    const countsByStatus: Record<RentalStatus, number> = {
      PENDING_PAYMENT: 0,
      CONFIRMED: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const row of countsRes.rows) {
      countsByStatus[row.status] = Number(row.cnt);
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status) {
      values.push(params.status);
      conditions.push(`r.status = $${values.length}`);
    }
    if (params.cnpj) {
      values.push(params.cnpj);
      conditions.push(`c.cnpj = $${values.length}`);
    }

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    values.push(limit);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const listRes = await db.query<{ id: string }>(
      `
      SELECT r.id
      FROM rentals r
      JOIN clients c ON c.id = r.client_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${values.length}
      `,
      values,
    );

    return {
      ids: listRes.rows.map((r) => r.id),
      countsByStatus,
    };
  }

  async listItemsByRentalId(db: Queryable, rentalId: string): Promise<RentalItemJoinedRow[]> {
    const res = await db.query<RentalItemJoinedRow>(
      `
      SELECT
        ri.id,
        ri.category_id,
        ec.name AS category_name,
        ec.base_daily_rate,
        ec.replacement_cost,
        ri.equipment_item_id,
        ei.asset_tag,
        ei.serial_number,
        ri.agreed_daily_rate
      FROM rental_items ri
      JOIN equipment_items ei ON ei.id = ri.equipment_item_id
      JOIN equipment_categories ec ON ec.id = ri.category_id
      WHERE ri.rental_id = $1::uuid
      ORDER BY ec.sort_order ASC, ei.asset_tag ASC
      `,
      [rentalId],
    );
    return res.rows;
  }

  /**
   * Builds quote lines and allocated item list from stored `rental_items`.
   */
  buildLinesAndAllocatedItems(
    itemRows: RentalItemJoinedRow[],
    days: number,
  ): { lines: QuoteLine[]; allocatedItems: RentalAllocatedItem[] } {
    const allocatedItems: RentalAllocatedItem[] = itemRows.map((r) => ({
      id: r.equipment_item_id,
      categoryId: r.category_id,
      categoryName: r.category_name,
      assetTag: r.asset_tag,
      agreedDailyRate: toNumber(r.agreed_daily_rate),
    }));

    const lineMap = new Map<string, QuoteLine>();
    for (const row of itemRows) {
      const baseRate = toNumber(row.base_daily_rate);
      const agreed = toNumber(row.agreed_daily_rate);
      const existing = lineMap.get(row.category_id);
      if (!existing) {
        const discountPct = baseRate > 0 ? Math.round((1 - agreed / baseRate) * 100) : 0;
        lineMap.set(row.category_id, {
          categoryId: row.category_id,
          categoryName: row.category_name,
          quantity: 1,
          baseDailyRate: baseRate,
          discountPct: Math.max(0, discountPct),
          agreedDailyRate: agreed,
          subtotal: round2(agreed * days),
        });
      } else {
        existing.quantity += 1;
        existing.subtotal = round2(existing.agreedDailyRate * existing.quantity * days);
      }
    }

    return { lines: Array.from(lineMap.values()), allocatedItems };
  }

  /**
   * Confirms a rental after payment approval, timestamps the physical asset
   * assignments on `rental_items`, and marks the assigned `equipment_items` as RENTED.
   */
  async confirmAndAssignAssets(tx: TxClient, rentalId: string): Promise<void> {
    await tx.query(
      `
      UPDATE rentals
      SET status = 'CONFIRMED',
          confirmed_at = COALESCE(confirmed_at, now()),
          payment_due_at = NULL
      WHERE id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE rental_items
      SET assigned_at = COALESCE(assigned_at, now()),
          blocks_inventory = TRUE
      WHERE rental_id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE equipment_items ei
      SET status = 'RENTED'
      FROM rental_items ri
      WHERE ri.rental_id = $1::uuid
        AND ri.equipment_item_id = ei.id
        AND ei.status = 'AVAILABLE'
      `,
      [rentalId],
    );
  }

  async markDispatched(tx: TxClient, rentalId: string): Promise<void> {
    await tx.query(
      `
      UPDATE rentals
      SET status = 'ACTIVE',
          dispatched_at = COALESCE(dispatched_at, now())
      WHERE id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE equipment_items ei
      SET status = 'RENTED'
      FROM rental_items ri
      WHERE ri.rental_id = $1::uuid
        AND ri.equipment_item_id = ei.id
      `,
      [rentalId],
    );
  }

  async markReturned(tx: TxClient, rentalId: string, maintenanceAssetTags: string[] = []): Promise<void> {
    await tx.query(
      `
      UPDATE rentals
      SET status = 'COMPLETED',
          completed_at = COALESCE(completed_at, now())
      WHERE id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE rental_items
      SET blocks_inventory = FALSE
      WHERE rental_id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE equipment_items ei
      SET status = CASE
        WHEN ei.asset_tag = ANY($2::text[]) THEN 'MAINTENANCE'
        ELSE 'AVAILABLE'
      END
      FROM rental_items ri
      WHERE ri.rental_id = $1::uuid
        AND ri.equipment_item_id = ei.id
      `,
      [rentalId, maintenanceAssetTags],
    );
  }

  async markCancelled(tx: TxClient, rentalId: string, reason: string): Promise<void> {
    await tx.query(
      `
      UPDATE rentals
      SET status = 'CANCELLED',
          cancelled_at = COALESCE(cancelled_at, now()),
          cancel_reason = $2
      WHERE id = $1::uuid
      `,
      [rentalId, reason],
    );

    await tx.query(
      `
      UPDATE rental_items
      SET blocks_inventory = FALSE
      WHERE rental_id = $1::uuid
      `,
      [rentalId],
    );

    await tx.query(
      `
      UPDATE equipment_items ei
      SET status = 'AVAILABLE'
      FROM rental_items ri
      WHERE ri.rental_id = $1::uuid
        AND ri.equipment_item_id = ei.id
        AND ei.status = 'RENTED'
        AND NOT EXISTS (
          SELECT 1
          FROM rental_items ri2
          JOIN rentals r2 ON r2.id = ri2.rental_id
          WHERE ri2.equipment_item_id = ei.id
            AND ri2.rental_id <> $1::uuid
            AND ri2.blocks_inventory = TRUE
            AND r2.status IN ('CONFIRMED', 'ACTIVE')
        )
      `,
      [rentalId],
    );
  }

  async extendPeriod(
    tx: TxClient,
    params: {
      rentalId: string;
      startDate: string;
      newEndDate: string;
      newSubtotal: number;
      newTotal: number;
    },
  ): Promise<void> {
    await tx.query(
      `
      UPDATE rentals
      SET end_date = $2::date,
          subtotal_amount = $3,
          total_amount = $4
      WHERE id = $1::uuid
      `,
      [params.rentalId, params.newEndDate, params.newSubtotal, params.newTotal],
    );

    await tx.query(
      `
      UPDATE rental_items
      SET rental_period = daterange($2::date, $3::date, '[]')
      WHERE rental_id = $1::uuid
      `,
      [params.rentalId, params.startDate, params.newEndDate],
    );
  }

  /**
   * Releases inventory holds for `PENDING_PAYMENT` rentals whose `payment_due_at`
   * has elapsed.
   */
  async expireOverduePendingRentals(db: Queryable): Promise<number> {
    const res = await db.query<{ id: string }>(
      `
      WITH expired AS (
        UPDATE rentals
        SET status = 'CANCELLED',
            cancelled_at = now(),
            cancel_reason = 'PAYMENT_TIMEOUT'
        WHERE status = 'PENDING_PAYMENT'
          AND payment_due_at IS NOT NULL
          AND payment_due_at <= now()
        RETURNING id
      )
      UPDATE rental_items ri
      SET blocks_inventory = FALSE
      FROM expired
      WHERE ri.rental_id = expired.id
      RETURNING expired.id
      `,
    );
    return res.rowCount ?? 0;
  }
}

export const rentalRepository = new RentalRepository();
