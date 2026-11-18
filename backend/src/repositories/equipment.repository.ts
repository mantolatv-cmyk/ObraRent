import type { Queryable, TxClient } from '../db/pool';
import { toNumber } from '../lib/money';
import { calculateSlotCapacity, STANDARD_TIME_SLOTS } from '../lib/time-slots';
import type {
  AvailableEquipmentItem,
  Category,
  CategoryAvailability,
  CategorySlotCapacity,
  EquipmentStatus,
  FleetItem,
  FleetSummary,
  TimeSlotAvailability,
  TimeSlotsResult,
} from '../types/domain';

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  base_daily_rate: string;
  replacement_cost: string;
  image_url: string | null;
  total_units: string;
  operational_units: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    baseDailyRate: toNumber(row.base_daily_rate),
    replacementCost: toNumber(row.replacement_cost),
    imageUrl: row.image_url,
    totalUnits: Number.parseInt(row.total_units, 10) || 0,
    operationalUnits: Number.parseInt(row.operational_units, 10) || 0,
  };
}

const CATEGORY_SELECT = `
  SELECT
    c.id,
    c.slug,
    c.name,
    c.description,
    c.base_daily_rate,
    c.replacement_cost,
    c.image_url,
    COUNT(ei.id) FILTER (WHERE ei.status <> 'RETIRED')::int AS total_units,
    COUNT(ei.id) FILTER (WHERE ei.status NOT IN ('MAINTENANCE', 'RETIRED'))::int AS operational_units
  FROM equipment_categories c
  LEFT JOIN equipment_items ei ON ei.category_id = c.id
`;

interface FleetRow {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  asset_tag: string;
  serial_number: string | null;
  status: EquipmentStatus;
  base_daily_rate: string;
  replacement_cost: string;
  active_rental_id: string | null;
  active_rental_code: string | null;
  current_end_date: string | null;
}

function mapFleetItem(row: FleetRow): FleetItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    status: row.status,
    baseDailyRate: toNumber(row.base_daily_rate),
    replacementCost: toNumber(row.replacement_cost),
    activeRentalId: row.active_rental_id,
    activeRentalCode: row.active_rental_code,
    currentEndDate: row.current_end_date,
  };
}

export class EquipmentRepository {
  async listCategories(db: Queryable): Promise<Category[]> {
    const res = await db.query<CategoryRow>(`
      ${CATEGORY_SELECT}
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);
    return res.rows.map(mapCategory);
  }

  async findCategoryById(db: Queryable, id: string): Promise<Category | null> {
    const res = await db.query<CategoryRow>(
      `
      ${CATEGORY_SELECT}
      WHERE c.id = $1 AND c.is_active = TRUE
      GROUP BY c.id
      `,
      [id],
    );
    const row = res.rows[0];
    return row ? mapCategory(row) : null;
  }

  async findCategoriesByIds(db: Queryable, ids: string[]): Promise<Map<string, Category>> {
    if (ids.length === 0) return new Map();
    const res = await db.query<CategoryRow>(
      `
      ${CATEGORY_SELECT}
      WHERE c.id = ANY($1::uuid[]) AND c.is_active = TRUE
      GROUP BY c.id
      `,
      [ids],
    );
    const map = new Map<string, Category>();
    for (const row of res.rows) {
      map.set(row.id, mapCategory(row));
    }
    return map;
  }

  /**
   * Real-time availability query: finds all operational physical items in each
   * requested category whose IDs are NOT allocated to any overlapping rental in
   * CONFIRMED, ACTIVE, or non-expired PENDING_PAYMENT status.
   */
  async getAvailability(
    db: Queryable,
    params: { startDate: string; endDate: string; categoryId?: string },
  ): Promise<CategoryAvailability[]> {
    const { startDate, endDate, categoryId } = params;
    const values: unknown[] = [startDate, endDate];
    let categoryFilter = '';
    if (categoryId) {
      values.push(categoryId);
      categoryFilter = `AND c.id = $3::uuid`;
    }

    interface AvailabilityJoinRow {
      category_id: string;
      category_name: string;
      base_daily_rate: string;
      sort_order: number;
      item_id: string | null;
      asset_tag: string | null;
      serial_number: string | null;
    }

    const res = await db.query<AvailabilityJoinRow>(
      `
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.base_daily_rate,
        c.sort_order,
        avail.id AS item_id,
        avail.asset_tag,
        avail.serial_number
      FROM equipment_categories c
      LEFT JOIN LATERAL (
        SELECT ei.id, ei.asset_tag, ei.serial_number
        FROM equipment_items ei
        WHERE ei.category_id = c.id
          AND ei.status NOT IN ('MAINTENANCE', 'RETIRED')
          AND NOT EXISTS (
            SELECT 1
            FROM rental_items ri
            JOIN rentals r ON r.id = ri.rental_id
            WHERE ri.equipment_item_id = ei.id
              AND ri.blocks_inventory = TRUE
              AND r.start_date <= $2::date
              AND r.end_date >= $1::date
              AND (
                r.status IN ('CONFIRMED', 'ACTIVE')
                OR (r.status = 'PENDING_PAYMENT' AND (r.payment_due_at IS NULL OR r.payment_due_at > now()))
              )
          )
        ORDER BY ei.asset_tag ASC
      ) avail ON TRUE
      WHERE c.is_active = TRUE
        ${categoryFilter}
      ORDER BY c.sort_order ASC, c.name ASC, avail.asset_tag ASC
      `,
      values,
    );

    const grouped = new Map<string, CategoryAvailability>();
    for (const row of res.rows) {
      let entry = grouped.get(row.category_id);
      if (!entry) {
        entry = {
          categoryId: row.category_id,
          categoryName: row.category_name,
          dailyRate: toNumber(row.base_daily_rate),
          availableCount: 0,
          availableItems: [],
        };
        grouped.set(row.category_id, entry);
      }
      if (row.item_id && row.asset_tag) {
        entry.availableItems.push({
          id: row.item_id,
          assetTag: row.asset_tag,
          serialNumber: row.serial_number,
        });
        entry.availableCount = entry.availableItems.length;
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Acquires a transaction-scoped advisory lock on the category and locks the
   * candidate physical rows (`FOR UPDATE`) to prevent concurrent overbooking.
   */
  async lockAndSelectAvailableItems(
    tx: TxClient,
    params: { categoryId: string; startDate: string; endDate: string; limit: number },
  ): Promise<AvailableEquipmentItem[]> {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [params.categoryId]);

    const res = await tx.query<{ id: string; asset_tag: string; serial_number: string | null }>(
      `
      SELECT ei.id, ei.asset_tag, ei.serial_number
      FROM equipment_items ei
      WHERE ei.category_id = $1::uuid
        AND ei.status NOT IN ('MAINTENANCE', 'RETIRED')
        AND NOT EXISTS (
          SELECT 1
          FROM rental_items ri
          JOIN rentals r ON r.id = ri.rental_id
          WHERE ri.equipment_item_id = ei.id
            AND ri.blocks_inventory = TRUE
            AND r.start_date <= $3::date
            AND r.end_date >= $2::date
            AND (
              r.status IN ('CONFIRMED', 'ACTIVE')
              OR (r.status = 'PENDING_PAYMENT' AND (r.payment_due_at IS NULL OR r.payment_due_at > now()))
            )
        )
      ORDER BY ei.asset_tag ASC
      FOR UPDATE OF ei
      LIMIT $4
      `,
      [params.categoryId, params.startDate, params.endDate, params.limit],
    );

    return res.rows.map((r) => ({
      id: r.id,
      assetTag: r.asset_tag,
      serialNumber: r.serial_number,
    }));
  }

  /**
   * Lists physical fleet items with their active contract reference for the
   * yard & operations dashboard (`/operacao`).
   */
  async listFleet(
    db: Queryable,
    params: { categoryId?: string; status?: EquipmentStatus } = {},
  ): Promise<{ items: FleetItem[]; summary: FleetSummary }> {
    const summaryRes = await db.query<{
      total: string;
      available: string;
      rented: string;
      maintenance: string;
      retired: string;
    }>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
        COUNT(*) FILTER (WHERE status = 'RENTED')::int AS rented,
        COUNT(*) FILTER (WHERE status = 'MAINTENANCE')::int AS maintenance,
        COUNT(*) FILTER (WHERE status = 'RETIRED')::int AS retired
      FROM equipment_items
    `);

    const sRow = summaryRes.rows[0];
    const summary: FleetSummary = {
      total: Number(sRow?.total ?? 0),
      available: Number(sRow?.available ?? 0),
      rented: Number(sRow?.rented ?? 0),
      maintenance: Number(sRow?.maintenance ?? 0),
      retired: Number(sRow?.retired ?? 0),
    };

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.categoryId) {
      values.push(params.categoryId);
      conditions.push(`ei.category_id = $${values.length}::uuid`);
    }
    if (params.status) {
      values.push(params.status);
      conditions.push(`ei.status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const itemsRes = await db.query<FleetRow>(
      `
      SELECT
        ei.id,
        ei.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        ei.asset_tag,
        ei.serial_number,
        ei.status,
        c.base_daily_rate,
        c.replacement_cost,
        active_r.id AS active_rental_id,
        active_r.code AS active_rental_code,
        active_r.end_date AS current_end_date
      FROM equipment_items ei
      JOIN equipment_categories c ON c.id = ei.category_id
      LEFT JOIN LATERAL (
        SELECT r.id, r.code, r.end_date
        FROM rental_items ri
        JOIN rentals r ON r.id = ri.rental_id
        WHERE ri.equipment_item_id = ei.id
          AND ri.blocks_inventory = TRUE
          AND r.status IN ('CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT')
        ORDER BY r.start_date ASC
        LIMIT 1
      ) active_r ON TRUE
      ${whereClause}
      ORDER BY c.sort_order ASC, ei.asset_tag ASC
      `,
      values,
    );

    return {
      items: itemsRes.rows.map(mapFleetItem),
      summary,
    };
  }

  async findFleetItemById(db: Queryable, id: string): Promise<FleetItem | null> {
    const res = await db.query<FleetRow>(
      `
      SELECT
        ei.id,
        ei.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        ei.asset_tag,
        ei.serial_number,
        ei.status,
        c.base_daily_rate,
        c.replacement_cost,
        active_r.id AS active_rental_id,
        active_r.code AS active_rental_code,
        active_r.end_date AS current_end_date
      FROM equipment_items ei
      JOIN equipment_categories c ON c.id = ei.category_id
      LEFT JOIN LATERAL (
        SELECT r.id, r.code, r.end_date
        FROM rental_items ri
        JOIN rentals r ON r.id = ri.rental_id
        WHERE ri.equipment_item_id = ei.id
          AND ri.blocks_inventory = TRUE
          AND r.status IN ('CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT')
        ORDER BY r.start_date ASC
        LIMIT 1
      ) active_r ON TRUE
      WHERE ei.id = $1::uuid
      `,
      [id],
    );
    const row = res.rows[0];
    return row ? mapFleetItem(row) : null;
  }

  async updateItemStatus(
    db: Queryable,
    id: string,
    status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
  ): Promise<FleetItem | null> {
    await db.query(
      `
      UPDATE equipment_items
      SET status = $2
      WHERE id = $1::uuid
      `,
      [id, status],
    );
    return this.findFleetItemById(db, id);
  }

  async getTimeSlotsAvailability(
    db: Queryable,
    params: {
      date: string;
      categoryRequests?: { categoryId: string; quantity: number }[];
    },
  ): Promise<TimeSlotsResult> {
    const { date, categoryRequests = [] } = params;
    const requestMap = new Map<string, number>();
    for (const req of categoryRequests) {
      requestMap.set(req.categoryId, req.quantity);
    }

    const catConditions: string[] = ['c.is_active = TRUE'];
    const catValues: unknown[] = [];
    if (categoryRequests.length > 0) {
      catValues.push(categoryRequests.map((r) => r.categoryId));
      catConditions.push(`c.id = ANY($${catValues.length}::uuid[])`);
    }

    interface CatOpRow {
      id: string;
      slug: string;
      name: string;
      operational_units: string;
    }

    const catRes = await db.query<CatOpRow>(
      `
      SELECT
        c.id,
        c.slug,
        c.name,
        COUNT(ei.id) FILTER (WHERE ei.status NOT IN ('MAINTENANCE', 'RETIRED'))::int AS operational_units
      FROM equipment_categories c
      LEFT JOIN equipment_items ei ON ei.category_id = c.id
      WHERE ${catConditions.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
      `,
      catValues,
    );

    interface BookedSlotRow {
      delivery_time_slot: string;
      category_id: string;
      booked_count: string;
    }

    const bookedRes = await db.query<BookedSlotRow>(
      `
      SELECT
        r.delivery_time_slot,
        ri.category_id,
        COUNT(ri.id)::int AS booked_count
      FROM rentals r
      JOIN rental_items ri ON ri.rental_id = r.id
      WHERE r.start_date = $1::date
        AND r.delivery_time_slot IS NOT NULL
        AND r.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE')
        AND (r.status <> 'PENDING_PAYMENT' OR r.payment_due_at IS NULL OR r.payment_due_at > now())
        AND ri.blocks_inventory = TRUE
      GROUP BY r.delivery_time_slot, ri.category_id
      `,
      [date],
    );

    const bookedMap = new Map<string, number>();
    for (const b of bookedRes.rows) {
      bookedMap.set(`${b.delivery_time_slot}:${b.category_id}`, Number(b.booked_count));
    }

    const slots: TimeSlotAvailability[] = STANDARD_TIME_SLOTS.map((slotDef) => {
      const categories: CategorySlotCapacity[] = catRes.rows.map((cat) => {
        const opUnits = Number(cat.operational_units) || 0;
        const slotCapacity = calculateSlotCapacity(opUnits);
        const booked = bookedMap.get(`${slotDef.slot}:${cat.id}`) ?? 0;
        const availableUnits = Math.max(0, slotCapacity - booked);
        const requestedQuantity = requestMap.get(cat.id) ?? 1;
        const isAvailable = availableUnits >= requestedQuantity;

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categorySlug: cat.slug,
          operationalUnits: opUnits,
          slotCapacity,
          bookedUnits: booked,
          availableUnits,
          isAvailable,
        };
      });

      const firstUnavailable = categories.find((c) => !c.isAvailable);
      const available = !firstUnavailable;
      const reason = firstUnavailable
        ? `Esgotado para ${firstUnavailable.categoryName} neste horário`
        : null;

      return {
        slot: slotDef.slot,
        label: slotDef.label,
        period: slotDef.period,
        periodLabel: slotDef.periodLabel,
        available,
        reason,
        categories,
      };
    });

    return {
      date,
      slots,
    };
  }
}

export const equipmentRepository = new EquipmentRepository();
