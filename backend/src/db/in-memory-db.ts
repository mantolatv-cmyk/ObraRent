import { createHash, randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import type {
  DeliveryAddress,
  EquipmentStatus,
  Freight,
  PaymentMethod,
  PaymentStatus,
  RentalChannel,
  RentalStatus,
  WhatsappContextData,
  WhatsappSessionState,
} from '../types/domain';

interface MemCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  base_daily_rate: string;
  replacement_cost: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface MemEquipmentItem {
  id: string;
  category_id: string;
  asset_tag: string;
  serial_number: string | null;
  status: EquipmentStatus;
}

interface MemClient {
  id: string;
  cnpj: string;
  company_name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  credit_limit: string;
  created_at: Date;
  updated_at: Date;
}

interface MemRental {
  id: string;
  code: string;
  client_id: string;
  start_date: string;
  end_date: string;
  subtotal_amount: string;
  freight_amount: string;
  total_amount: string;
  status: RentalStatus;
  channel: RentalChannel;
  delivery_time_slot: string | null;
  delivery_address: DeliveryAddress;
  freight_details: Partial<Freight>;
  contact_phone: string | null;
  payment_due_at: Date | null;
  confirmed_at: Date | null;
  dispatched_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MemRentalItem {
  id: string;
  rental_id: string;
  equipment_item_id: string;
  category_id: string;
  agreed_daily_rate: string;
  start_date: string;
  end_date: string;
  blocks_inventory: boolean;
  assigned_at: Date | null;
  created_at: Date;
}

interface MemPayment {
  id: string;
  rental_id: string;
  gateway: string;
  gateway_tx_id: string;
  amount: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  pix_copy_paste: string | null;
  invoice_url: string | null;
  expires_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface MemWhatsappSession {
  phone_number: string;
  client_id: string | null;
  current_state: WhatsappSessionState;
  context_data: WhatsappContextData;
  updated_at: Date;
}

function deterministicUuid(seed: string): string {
  const hash = createHash('md5').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

class InMemoryDatabase {
  categories: MemCategory[] = [];
  items: MemEquipmentItem[] = [];
  clients: MemClient[] = [];
  rentals: MemRental[] = [];
  rentalItems: MemRentalItem[] = [];
  payments: MemPayment[] = [];
  webhookEvents = new Set<string>();
  whatsappSessions = new Map<string, MemWhatsappSession>();

  constructor() {
    this.seed();
  }

  private seed(): void {
    const rawCats: Omit<MemCategory, 'id' | 'is_active'>[] = [
      {
        slug: 'compactador-de-solo',
        name: 'Compactador de Solo (Sapo)',
        description: 'Compactador a percussão 4T, ideal para valas, aterros e bases de piso.',
        base_daily_rate: '180.00',
        replacement_cost: '14500.00',
        sort_order: 10,
        image_url: '/images/equipment/compactador-de-solo.jpg',
      },
      {
        slug: 'placa-vibratoria',
        name: 'Placa Vibratória',
        description: 'Placa reversível para compactação de bloquetes, brita e solo granular.',
        base_daily_rate: '150.00',
        replacement_cost: '9800.00',
        sort_order: 20,
        image_url: '/images/equipment/placa-vibratoria.jpg',
      },
      {
        slug: 'martelete-rompedor',
        name: 'Martelete Rompedor 10kg',
        description: 'Rompedor elétrico SDS-Max para demolição de concreto e alvenaria.',
        base_daily_rate: '120.00',
        replacement_cost: '6500.00',
        sort_order: 30,
        image_url: '/images/equipment/martelete-rompedor.jpg',
      },
      {
        slug: 'alisadora-de-concreto',
        name: 'Alisadora de Concreto (Bambolê)',
        description: 'Acabadora a gasolina 36" para desempeno e alisamento de lajes e pisos.',
        base_daily_rate: '160.00',
        replacement_cost: '11000.00',
        sort_order: 40,
        image_url: '/images/equipment/alisadora-de-concreto.jpg',
      },
      {
        slug: 'cortadora-de-piso',
        name: 'Cortadora de Piso e Asfalto',
        description: 'Serra com disco diamantado 14", corte a úmido até 12 cm de profundidade.',
        base_daily_rate: '190.00',
        replacement_cost: '13500.00',
        sort_order: 50,
        image_url: '/images/equipment/cortadora-de-piso.jpg',
      },
      {
        slug: 'andaime-tubular',
        name: 'Andaime Tubular (módulo 1,5 m)',
        description: 'Módulo com 2 painéis, travessas e sapatas. Diária por módulo.',
        base_daily_rate: '12.00',
        replacement_cost: '650.00',
        sort_order: 60,
        image_url: '/images/equipment/andaime-tubular.jpg',
      },
      {
        slug: 'escora-metalica',
        name: 'Escora Metálica Regulável',
        description: 'Escora 2,0 a 3,5 m para escoramento de lajes e vigas. Diária por peça.',
        base_daily_rate: '3.50',
        replacement_cost: '180.00',
        sort_order: 70,
        image_url: '/images/equipment/escora-metalica.jpg',
      },
      {
        slug: 'betoneira-400l',
        name: 'Betoneira 400 Litros',
        description: 'Betoneira profissional 400L motor monofásico 2CV bivolt para preparo de concreto e argamassa em obra.',
        base_daily_rate: '85.00',
        replacement_cost: '5800.00',
        sort_order: 80,
        image_url: '/images/equipment/betoneira-400l.jpg',
      },
      {
        slug: 'vibrador-de-concreto',
        name: 'Vibrador de Concreto com Mangote',
        description: 'Motor vibrador de imersão com mangote pendular 38mm (5 metros) para adensamento de concreto sem bolhas.',
        base_daily_rate: '75.00',
        replacement_cost: '3600.00',
        sort_order: 90,
        image_url: '/images/equipment/vibrador-de-concreto.jpg',
      },
      {
        slug: 'martelete-demolidor-30kg',
        name: 'Martelete Demolidor Pesado 30kg',
        description: 'Martelo demolidor elétrico 30kg (65 Joules) encaixe sextavado para ruptura pesada de pisos, vigas e sapatas.',
        base_daily_rate: '170.00',
        replacement_cost: '11200.00',
        sort_order: 100,
        image_url: '/images/equipment/martelete-demolidor-30kg.jpg',
      },
      {
        slug: 'regua-vibratoria',
        name: 'Régua Vibratória para Concreto',
        description: 'Régua vibratória a gasolina 4T com perfil de alumínio de 3m para sarrafeamento e nivelamento rápido de pisos.',
        base_daily_rate: '135.00',
        replacement_cost: '7400.00',
        sort_order: 110,
        image_url: '/images/equipment/regua-vibratoria.jpg',
      },
      {
        slug: 'gerador-de-energia',
        name: 'Gerador de Energia 8 kVA',
        description: 'Grupo gerador a gasolina 8 kVA partida elétrica com tomadas 110V/220V para canteiros de obras e eventos.',
        base_daily_rate: '240.00',
        replacement_cost: '16500.00',
        sort_order: 120,
        image_url: '/images/equipment/gerador-de-energia.jpg',
      },
      {
        slug: 'plataforma-andaime',
        name: 'Piso Metálico para Andaime (1,5 m)',
        description: 'Pranchão metálico antiderrapante 1,5m (NR-18) com travas de segurança para plataforma de trabalho em andaimes.',
        base_daily_rate: '6.00',
        replacement_cost: '320.00',
        sort_order: 130,
        image_url: '/images/equipment/plataforma-andaime.jpg',
      },
      {
        slug: 'guincho-de-coluna',
        name: 'Guincho de Coluna Elétrico 400kg',
        description: 'Talha elétrica de coluna 400kg com cabo de aço 30m e botoeira pendente para içamento seguro de materiais em lajes.',
        base_daily_rate: '95.00',
        replacement_cost: '4800.00',
        sort_order: 140,
        image_url: '/images/equipment/guincho-de-coluna.jpg',
      },
      {
        slug: 'motobomba-submersivel',
        name: 'Motobomba Submersível 3" (Bomba Mangote)',
        description: 'Bomba de drenagem 3" de alta vazão para esgotamento de valas, fundações, caixas e águas sujas em canteiros.',
        base_daily_rate: '110.00',
        replacement_cost: '5200.00',
        sort_order: 150,
        image_url: '/images/equipment/motobomba-submersivel.jpg',
      },
    ];

    this.categories = rawCats.map((c) => ({
      ...c,
      id: deterministicUuid(`cat:${c.slug}`),
      is_active: true,
    }));

    const fleet: { slug: string; prefix: string; units: number; inMaintenance: number }[] = [
      { slug: 'compactador-de-solo', prefix: 'CMP', units: 6, inMaintenance: 1 },
      { slug: 'betoneira-400l', prefix: 'BET', units: 12, inMaintenance: 1 },
      { slug: 'placa-vibratoria', prefix: 'PLV', units: 6, inMaintenance: 0 },
      { slug: 'vibrador-de-concreto', prefix: 'VIB', units: 10, inMaintenance: 1 },
      { slug: 'martelete-rompedor', prefix: 'MRT', units: 10, inMaintenance: 1 },
      { slug: 'martelete-demolidor-30kg', prefix: 'DEM', units: 6, inMaintenance: 0 },
      { slug: 'alisadora-de-concreto', prefix: 'ALS', units: 4, inMaintenance: 0 },
      { slug: 'regua-vibratoria', prefix: 'REG', units: 5, inMaintenance: 0 },
      { slug: 'cortadora-de-piso', prefix: 'CTP', units: 4, inMaintenance: 1 },
      { slug: 'gerador-de-energia', prefix: 'GER', units: 6, inMaintenance: 0 },
      { slug: 'andaime-tubular', prefix: 'AND', units: 60, inMaintenance: 0 },
      { slug: 'plataforma-andaime', prefix: 'PLT', units: 80, inMaintenance: 0 },
      { slug: 'escora-metalica', prefix: 'ESC', units: 200, inMaintenance: 0 },
      { slug: 'guincho-de-coluna', prefix: 'GUI', units: 8, inMaintenance: 0 },
      { slug: 'motobomba-submersivel', prefix: 'BMB', units: 6, inMaintenance: 0 },
    ];

    for (const f of fleet) {
      const cat = this.categories.find((c) => c.slug === f.slug)!;
      for (let n = 1; n <= f.units; n++) {
        const assetTag = `${f.prefix}-${String(n).padStart(4, '0')}`;
        const snHash = createHash('md5').update(`${f.prefix}${n}`).digest('hex').slice(0, 10).toUpperCase();
        this.items.push({
          id: deterministicUuid(`item:${assetTag}`),
          category_id: cat.id,
          asset_tag: assetTag,
          serial_number: `SN${snHash}`,
          status: n > f.units - f.inMaintenance ? 'MAINTENANCE' : 'AVAILABLE',
        });
      }
    }

    const now = new Date();
    this.clients.push({
      id: deterministicUuid('client:11222333000181'),
      cnpj: '11222333000181',
      company_name: 'Construtora Exemplo Ltda',
      trade_name: 'Exemplo Obras',
      email: 'compras@exemplo-obras.com.br',
      phone: '5511987654321',
      password_hash: null,
      credit_limit: '50000.00',
      created_at: now,
      updated_at: now,
    });
  }

  private isBlockingRental(r: MemRental, now = new Date()): boolean {
    if (r.status === 'CONFIRMED' || r.status === 'ACTIVE') return true;
    if (r.status === 'PENDING_PAYMENT') {
      return !r.payment_due_at || r.payment_due_at > now;
    }
    return false;
  }

  private isItemAvailableInRange(itemId: string, startDate: string, endDate: string): boolean {
    const now = new Date();
    for (const ri of this.rentalItems) {
      if (ri.equipment_item_id !== itemId || !ri.blocks_inventory) continue;
      const r = this.rentals.find((x) => x.id === ri.rental_id);
      if (!r || !this.isBlockingRental(r, now)) continue;
      if (r.start_date <= endDate && r.end_date >= startDate) {
        return false;
      }
    }
    return true;
  }

  private buildCategoryRow(cat: MemCategory) {
    const catItems = this.items.filter((i) => i.category_id === cat.id);
    const totalUnits = catItems.filter((i) => i.status !== 'RETIRED').length;
    const operationalUnits = catItems.filter(
      (i) => i.status !== 'MAINTENANCE' && i.status !== 'RETIRED',
    ).length;
    return {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      base_daily_rate: cat.base_daily_rate,
      replacement_cost: cat.replacement_cost,
      image_url: cat.image_url,
      total_units: String(totalUnits),
      operational_units: String(operationalUnits),
    };
  }

  private buildFleetRow(ei: MemEquipmentItem) {
    const cat = this.categories.find((c) => c.id === ei.category_id)!;
    const activeRentals = this.rentalItems
      .filter((ri) => ri.equipment_item_id === ei.id && ri.blocks_inventory)
      .map((ri) => this.rentals.find((r) => r.id === ri.rental_id))
      .filter(
        (r): r is MemRental =>
          Boolean(r) &&
          (r!.status === 'CONFIRMED' || r!.status === 'ACTIVE' || r!.status === 'PENDING_PAYMENT'),
      )
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    const active = activeRentals[0] ?? null;
    return {
      id: ei.id,
      category_id: ei.category_id,
      category_name: cat.name,
      category_slug: cat.slug,
      asset_tag: ei.asset_tag,
      serial_number: ei.serial_number,
      status: ei.status,
      base_daily_rate: cat.base_daily_rate,
      replacement_cost: cat.replacement_cost,
      active_rental_id: active?.id ?? null,
      active_rental_code: active?.code ?? null,
      current_end_date: active?.end_date ?? null,
    };
  }

  private ok<R extends QueryResultRow = QueryResultRow>(rows: unknown[], rowCount?: number): QueryResult<R> {
    return {
      command: '',
      oid: 0,
      fields: [],
      rows: rows as R[],
      rowCount: rowCount ?? rows.length,
    };
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<R>> {
    const sql = text.replace(/\s+/g, ' ').trim();

    // 1. Transaction & control commands
    if (
      sql === 'SELECT 1' ||
      sql === 'BEGIN' ||
      sql === 'COMMIT' ||
      sql === 'ROLLBACK' ||
      sql.startsWith('SAVEPOINT ') ||
      sql.startsWith('RELEASE SAVEPOINT ') ||
      sql.startsWith('ROLLBACK TO SAVEPOINT ') ||
      sql.startsWith('SELECT pg_advisory_xact_lock') ||
      sql.startsWith('ALTER TABLE ')
    ) {
      return this.ok<R>([{ '?column?': 1 }]);
    }

    if (sql.includes('information_schema.tables')) {
      return this.ok<R>([{ count: '1' }]);
    }

    // 2. Equipment Categories
    if (sql.includes('FROM equipment_categories c') && sql.includes('total_units')) {
      const sorted = [...this.categories].filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
      if (sql.includes('WHERE c.id = $1')) {
        const id = String(values[0] ?? '');
        const found = sorted.filter((c) => c.id === id);
        return this.ok<R>(found.map((c) => this.buildCategoryRow(c)));
      }
      if (sql.includes('WHERE c.id = ANY($1::uuid[])')) {
        const ids = new Set((values[0] as string[]) ?? []);
        const found = sorted.filter((c) => ids.has(c.id));
        return this.ok<R>(found.map((c) => this.buildCategoryRow(c)));
      }
      return this.ok<R>(sorted.map((c) => this.buildCategoryRow(c)));
    }

    // 3. Time Slots Category operational units
    if (sql.includes('FROM equipment_categories c') && sql.includes('operational_units') && !sql.includes('total_units')) {
      let cats = [...this.categories].filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
      if (sql.includes('ANY($1::uuid[])') && Array.isArray(values[0])) {
        const idSet = new Set(values[0] as string[]);
        cats = cats.filter((c) => idSet.has(c.id));
      }
      const rows = cats.map((c) => {
        const opCount = this.items.filter(
          (i) => i.category_id === c.id && i.status !== 'MAINTENANCE' && i.status !== 'RETIRED',
        ).length;
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          operational_units: String(opCount),
        };
      });
      return this.ok<R>(rows);
    }

    // 4. Time Slots booked count
    if (sql.includes('r.delivery_time_slot') && sql.includes('GROUP BY r.delivery_time_slot, ri.category_id')) {
      const date = String(values[0] ?? '');
      const now = new Date();
      const counts = new Map<string, { delivery_time_slot: string; category_id: string; booked_count: number }>();
      for (const r of this.rentals) {
        if (r.start_date !== date || !r.delivery_time_slot || !this.isBlockingRental(r, now)) continue;
        for (const ri of this.rentalItems) {
          if (ri.rental_id !== r.id || !ri.blocks_inventory) continue;
          const key = `${r.delivery_time_slot}:${ri.category_id}`;
          const cur = counts.get(key) ?? {
            delivery_time_slot: r.delivery_time_slot,
            category_id: ri.category_id,
            booked_count: 0,
          };
          cur.booked_count += 1;
          counts.set(key, cur);
        }
      }
      return this.ok<R>(
        Array.from(counts.values()).map((c) => ({
          ...c,
          booked_count: String(c.booked_count),
        })),
      );
    }

    if (sql.includes('r.delivery_time_slot = $2') && sql.includes('ri.category_id = $3::uuid')) {
      const date = String(values[0] ?? '');
      const slot = String(values[1] ?? '');
      const catId = String(values[2] ?? '');
      const now = new Date();
      let count = 0;
      for (const r of this.rentals) {
        if (r.start_date !== date || r.delivery_time_slot !== slot || !this.isBlockingRental(r, now)) continue;
        for (const ri of this.rentalItems) {
          if (ri.rental_id === r.id && ri.blocks_inventory && ri.category_id === catId) {
            count += 1;
          }
        }
      }
      return this.ok<R>([{ count: String(count) }]);
    }

    // 5. Real-time availability (LEFT JOIN LATERAL)
    if (sql.includes('FROM equipment_categories c') && sql.includes('LEFT JOIN LATERAL')) {
      const startDate = String(values[0] ?? '');
      const endDate = String(values[1] ?? '');
      const filterCatId = values[2] ? String(values[2]) : null;

      let cats = [...this.categories].filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
      if (filterCatId) {
        cats = cats.filter((c) => c.id === filterCatId);
      }

      const rows: unknown[] = [];
      for (const cat of cats) {
        const availItems = this.items
          .filter(
            (ei) =>
              ei.category_id === cat.id &&
              ei.status !== 'MAINTENANCE' &&
              ei.status !== 'RETIRED' &&
              this.isItemAvailableInRange(ei.id, startDate, endDate),
          )
          .sort((a, b) => a.asset_tag.localeCompare(b.asset_tag));

        if (availItems.length === 0) {
          rows.push({
            category_id: cat.id,
            category_name: cat.name,
            base_daily_rate: cat.base_daily_rate,
            sort_order: cat.sort_order,
            item_id: null,
            asset_tag: null,
            serial_number: null,
          });
        } else {
          for (const ei of availItems) {
            rows.push({
              category_id: cat.id,
              category_name: cat.name,
              base_daily_rate: cat.base_daily_rate,
              sort_order: cat.sort_order,
              item_id: ei.id,
              asset_tag: ei.asset_tag,
              serial_number: ei.serial_number,
            });
          }
        }
      }
      return this.ok<R>(rows);
    }

    // 6. lockAndSelectAvailableItems
    if (sql.includes('FROM equipment_items ei') && sql.includes('FOR UPDATE OF ei')) {
      const categoryId = String(values[0] ?? '');
      const startDate = String(values[1] ?? '');
      const endDate = String(values[2] ?? '');
      const limit = Number(values[3] ?? 1);

      const avail = this.items
        .filter(
          (ei) =>
            ei.category_id === categoryId &&
            ei.status !== 'MAINTENANCE' &&
            ei.status !== 'RETIRED' &&
            this.isItemAvailableInRange(ei.id, startDate, endDate),
        )
        .sort((a, b) => a.asset_tag.localeCompare(b.asset_tag))
        .slice(0, limit)
        .map((ei) => ({
          id: ei.id,
          asset_tag: ei.asset_tag,
          serial_number: ei.serial_number,
        }));

      return this.ok<R>(avail);
    }

    // 7. Fleet summary & list
    if (sql.includes('FROM equipment_items') && sql.includes("FILTER (WHERE status = 'AVAILABLE')")) {
      return this.ok<R>([
        {
          total: String(this.items.length),
          available: String(this.items.filter((i) => i.status === 'AVAILABLE').length),
          rented: String(this.items.filter((i) => i.status === 'RENTED').length),
          maintenance: String(this.items.filter((i) => i.status === 'MAINTENANCE').length),
          retired: String(this.items.filter((i) => i.status === 'RETIRED').length),
        },
      ]);
    }

    if (sql.includes('FROM equipment_items ei') && sql.includes('active_rental_code')) {
      if (sql.includes('WHERE ei.id = $1::uuid')) {
        const id = String(values[0] ?? '');
        const found = this.items.find((i) => i.id === id);
        return this.ok<R>(found ? [this.buildFleetRow(found)] : []);
      }
      let filtered = [...this.items];
      let valIdx = 0;
      if (sql.includes('ei.category_id =')) {
        const catId = String(values[valIdx++] ?? '');
        filtered = filtered.filter((i) => i.category_id === catId);
      }
      if (sql.includes('ei.status =')) {
        const st = String(values[valIdx++] ?? '');
        filtered = filtered.filter((i) => i.status === st);
      }
      const rows = filtered
        .map((ei) => this.buildFleetRow(ei))
        .sort((a, b) => {
          const catA = this.categories.find((c) => c.id === a.category_id)!.sort_order;
          const catB = this.categories.find((c) => c.id === b.category_id)!.sort_order;
          return catA !== catB ? catA - catB : a.asset_tag.localeCompare(b.asset_tag);
        });
      return this.ok<R>(rows);
    }

    if (sql.startsWith('UPDATE equipment_items SET status = $2 WHERE id = $1::uuid')) {
      const id = String(values[0] ?? '');
      const status = String(values[1] ?? 'AVAILABLE') as EquipmentStatus;
      const item = this.items.find((i) => i.id === id);
      if (item) item.status = status;
      return this.ok<R>([], item ? 1 : 0);
    }

    // 8. Clients
    if (sql.includes('FROM clients WHERE cnpj = $1')) {
      const cnpj = String(values[0] ?? '');
      const c = this.clients.find((x) => x.cnpj === cnpj);
      return this.ok<R>(c ? [c] : []);
    }
    if (sql.includes('FROM clients WHERE lower(email) = lower($1)')) {
      const email = String(values[0] ?? '').toLowerCase();
      const c = this.clients.find((x) => x.email?.toLowerCase() === email);
      return this.ok<R>(c ? [c] : []);
    }
    if (sql.includes('FROM clients WHERE id = $1::uuid')) {
      const id = String(values[0] ?? '');
      const c = this.clients.find((x) => x.id === id);
      return this.ok<R>(c ? [c] : []);
    }
    if (sql.includes('FROM clients WHERE phone = $1')) {
      const phone = String(values[0] ?? '');
      const c = this.clients.find((x) => x.phone === phone);
      return this.ok<R>(c ? [c] : []);
    }
    if (sql.startsWith('INSERT INTO clients')) {
      const cnpj = String(values[0] ?? '');
      const companyName = String(values[1] ?? '');
      const tradeName = values[2] != null ? String(values[2]) : null;
      const email = values[3] != null ? String(values[3]) : null;
      const phone = values[4] != null ? String(values[4]) : null;
      const hasPassword = values.length >= 6;
      const passwordHash = hasPassword && values[5] != null ? String(values[5]) : null;

      let existing = this.clients.find((x) => x.cnpj === cnpj);
      const now = new Date();
      if (existing) {
        if (companyName) existing.company_name = companyName;
        if (tradeName !== null) existing.trade_name = tradeName;
        if (email !== null) existing.email = email;
        if (phone !== null) existing.phone = phone;
        if (hasPassword) existing.password_hash = passwordHash;
        existing.updated_at = now;
      } else {
        existing = {
          id: randomUUID(),
          cnpj,
          company_name: companyName,
          trade_name: tradeName,
          email,
          phone,
          password_hash: passwordHash,
          credit_limit: '15000.00',
          created_at: now,
          updated_at: now,
        };
        this.clients.push(existing);
      }
      return this.ok<R>([existing]);
    }

    // 9. Rentals
    if (sql.startsWith('INSERT INTO rentals')) {
      const now = new Date();
      const rental: MemRental = {
        id: randomUUID(),
        code: String(values[0]),
        client_id: String(values[1]),
        start_date: String(values[2]),
        end_date: String(values[3]),
        subtotal_amount: Number(values[4]).toFixed(2),
        freight_amount: Number(values[5]).toFixed(2),
        total_amount: Number(values[6]).toFixed(2),
        status: 'PENDING_PAYMENT',
        channel: String(values[7]) as RentalChannel,
        delivery_address: typeof values[8] === 'string' ? JSON.parse(values[8]) : (values[8] as DeliveryAddress),
        freight_details: typeof values[9] === 'string' ? JSON.parse(values[9]) : (values[9] as Partial<Freight>),
        contact_phone: values[10] != null ? String(values[10]) : null,
        payment_due_at: values[11] instanceof Date ? values[11] : values[11] ? new Date(String(values[11])) : null,
        delivery_time_slot: values[12] != null ? String(values[12]) : null,
        confirmed_at: null,
        dispatched_at: null,
        completed_at: null,
        cancelled_at: null,
        cancel_reason: null,
        created_at: now,
        updated_at: now,
      };
      this.rentals.push(rental);
      return this.ok<R>([{ id: rental.id, created_at: rental.created_at }]);
    }

    if (sql.startsWith('INSERT INTO rental_items')) {
      const rentalId = String(values[0]);
      const equipmentItemId = String(values[1]);
      const categoryId = String(values[2]);
      const agreedDailyRate = Number(values[3]).toFixed(2);
      const startDate = String(values[4]);
      const endDate = String(values[5]);

      if (!this.isItemAvailableInRange(equipmentItemId, startDate, endDate)) {
        const err = new Error('exclusion constraint excl_asset_double_booking') as Error & { code: string };
        err.code = '23P01';
        throw err;
      }

      this.rentalItems.push({
        id: randomUUID(),
        rental_id: rentalId,
        equipment_item_id: equipmentItemId,
        category_id: categoryId,
        agreed_daily_rate: agreedDailyRate,
        start_date: startDate,
        end_date: endDate,
        blocks_inventory: true,
        assigned_at: null,
        created_at: new Date(),
      });
      return this.ok<R>([], 1);
    }

    if (sql.includes('FROM rentals r JOIN clients c ON c.id = r.client_id WHERE r.id = $1::uuid')) {
      const rentalId = String(values[0] ?? '');
      const r = this.rentals.find((x) => x.id === rentalId);
      if (!r) return this.ok<R>([]);
      const c = this.clients.find((x) => x.id === r.client_id)!;
      return this.ok<R>([
        {
          id: r.id,
          code: r.code,
          client_id: r.client_id,
          client_cnpj: c.cnpj,
          client_company_name: c.company_name,
          client_trade_name: c.trade_name,
          client_email: c.email,
          client_phone: c.phone,
          start_date: r.start_date,
          end_date: r.end_date,
          subtotal_amount: r.subtotal_amount,
          freight_amount: r.freight_amount,
          total_amount: r.total_amount,
          status: r.status,
          channel: r.channel,
          delivery_address: r.delivery_address,
          freight_details: r.freight_details,
          contact_phone: r.contact_phone,
          payment_due_at: r.payment_due_at,
          delivery_time_slot: r.delivery_time_slot,
          created_at: r.created_at,
        },
      ]);
    }

    if (sql.includes('SELECT status, COUNT(*)::int AS cnt FROM rentals GROUP BY status')) {
      const counts = new Map<RentalStatus, number>();
      for (const r of this.rentals) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      }
      return this.ok<R>(
        Array.from(counts.entries()).map(([status, cnt]) => ({ status, cnt: String(cnt) })),
      );
    }

    if (sql.includes('SELECT r.id FROM rentals r JOIN clients c ON c.id = r.client_id')) {
      let list = [...this.rentals];
      let idx = 0;
      if (sql.includes('r.status =')) {
        const st = String(values[idx++]);
        list = list.filter((r) => r.status === st);
      }
      if (sql.includes('c.cnpj =')) {
        const cnpj = String(values[idx++]);
        list = list.filter((r) => {
          const c = this.clients.find((x) => x.id === r.client_id);
          return c?.cnpj === cnpj;
        });
      }
      const limit = Number(values[idx] ?? 50);
      list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return this.ok<R>(list.slice(0, limit).map((r) => ({ id: r.id })));
    }

    if (sql.includes('FROM rental_items ri JOIN equipment_items ei') && sql.includes('WHERE ri.rental_id = $1::uuid')) {
      const rentalId = String(values[0] ?? '');
      const rows = this.rentalItems
        .filter((ri) => ri.rental_id === rentalId)
        .map((ri) => {
          const ei = this.items.find((i) => i.id === ri.equipment_item_id)!;
          const ec = this.categories.find((c) => c.id === ri.category_id)!;
          return {
            id: ri.id,
            category_id: ri.category_id,
            category_name: ec.name,
            base_daily_rate: ec.base_daily_rate,
            replacement_cost: ec.replacement_cost,
            equipment_item_id: ri.equipment_item_id,
            asset_tag: ei.asset_tag,
            serial_number: ei.serial_number,
            agreed_daily_rate: ri.agreed_daily_rate,
            _sort: ec.sort_order,
          };
        })
        .sort((a, b) => (a._sort !== b._sort ? a._sort - b._sort : a.asset_tag.localeCompare(b.asset_tag)));
      return this.ok<R>(rows);
    }

    if (sql.startsWith("UPDATE rentals SET status = 'CONFIRMED'")) {
      const rentalId = String(values[0] ?? '');
      const r = this.rentals.find((x) => x.id === rentalId);
      if (r) {
        r.status = 'CONFIRMED';
        r.confirmed_at = r.confirmed_at ?? new Date();
        r.payment_due_at = null;
      }
      return this.ok<R>([], r ? 1 : 0);
    }

    if (sql.startsWith('UPDATE rental_items SET assigned_at =')) {
      const rentalId = String(values[0] ?? '');
      for (const ri of this.rentalItems) {
        if (ri.rental_id === rentalId) {
          ri.assigned_at = ri.assigned_at ?? new Date();
          ri.blocks_inventory = true;
        }
      }
      return this.ok<R>([]);
    }

    if (sql.startsWith("UPDATE equipment_items ei SET status = 'RENTED' FROM rental_items ri")) {
      const rentalId = String(values[0] ?? '');
      const itemIds = new Set(
        this.rentalItems.filter((ri) => ri.rental_id === rentalId).map((ri) => ri.equipment_item_id),
      );
      for (const ei of this.items) {
        if (itemIds.has(ei.id)) {
          ei.status = 'RENTED';
        }
      }
      return this.ok<R>([]);
    }

    if (sql.startsWith("UPDATE rentals SET status = 'ACTIVE'")) {
      const rentalId = String(values[0] ?? '');
      const r = this.rentals.find((x) => x.id === rentalId);
      if (r) {
        r.status = 'ACTIVE';
        r.dispatched_at = r.dispatched_at ?? new Date();
      }
      return this.ok<R>([], r ? 1 : 0);
    }

    if (sql.startsWith("UPDATE rentals SET status = 'COMPLETED'")) {
      const rentalId = String(values[0] ?? '');
      const r = this.rentals.find((x) => x.id === rentalId);
      if (r) {
        r.status = 'COMPLETED';
        r.completed_at = r.completed_at ?? new Date();
      }
      return this.ok<R>([], r ? 1 : 0);
    }

    if (sql.startsWith('UPDATE rental_items SET blocks_inventory = FALSE WHERE rental_id = $1::uuid')) {
      const rentalId = String(values[0] ?? '');
      for (const ri of this.rentalItems) {
        if (ri.rental_id === rentalId) {
          ri.blocks_inventory = false;
        }
      }
      return this.ok<R>([]);
    }

    if (sql.includes("WHEN ei.asset_tag = ANY($2::text[]) THEN 'MAINTENANCE'")) {
      const rentalId = String(values[0] ?? '');
      const maintTags = new Set((values[1] as string[]) ?? []);
      const itemIds = new Set(
        this.rentalItems.filter((ri) => ri.rental_id === rentalId).map((ri) => ri.equipment_item_id),
      );
      for (const ei of this.items) {
        if (itemIds.has(ei.id)) {
          ei.status = maintTags.has(ei.asset_tag) ? 'MAINTENANCE' : 'AVAILABLE';
        }
      }
      return this.ok<R>([]);
    }

    if (sql.startsWith("UPDATE rentals SET status = 'CANCELLED'")) {
      const rentalId = String(values[0] ?? '');
      const reason = String(values[1] ?? '');
      const r = this.rentals.find((x) => x.id === rentalId);
      if (r) {
        r.status = 'CANCELLED';
        r.cancelled_at = r.cancelled_at ?? new Date();
        r.cancel_reason = reason;
      }
      return this.ok<R>([], r ? 1 : 0);
    }

    if (sql.startsWith("UPDATE equipment_items ei SET status = 'AVAILABLE' FROM rental_items ri")) {
      const rentalId = String(values[0] ?? '');
      const itemIds = new Set(
        this.rentalItems.filter((ri) => ri.rental_id === rentalId).map((ri) => ri.equipment_item_id),
      );
      for (const ei of this.items) {
        if (itemIds.has(ei.id) && ei.status === 'RENTED') {
          ei.status = 'AVAILABLE';
        }
      }
      return this.ok<R>([]);
    }

    if (sql.startsWith('UPDATE rentals SET end_date = $2::date')) {
      const rentalId = String(values[0] ?? '');
      const newEndDate = String(values[1] ?? '');
      const newSubtotal = Number(values[2] ?? 0).toFixed(2);
      const newTotal = Number(values[3] ?? 0).toFixed(2);
      const r = this.rentals.find((x) => x.id === rentalId);
      if (r) {
        r.end_date = newEndDate;
        r.subtotal_amount = newSubtotal;
        r.total_amount = newTotal;
      }
      return this.ok<R>([], r ? 1 : 0);
    }

    if (sql.startsWith('UPDATE rental_items SET rental_period = daterange')) {
      const rentalId = String(values[0] ?? '');
      const startDate = String(values[1] ?? '');
      const newEndDate = String(values[2] ?? '');
      for (const ri of this.rentalItems) {
        if (ri.rental_id === rentalId) {
          ri.start_date = startDate;
          ri.end_date = newEndDate;
        }
      }
      return this.ok<R>([]);
    }

    if (sql.includes("cancel_reason = 'PAYMENT_TIMEOUT'")) {
      const now = new Date();
      const expiredIds: string[] = [];
      for (const r of this.rentals) {
        if (r.status === 'PENDING_PAYMENT' && r.payment_due_at && r.payment_due_at <= now) {
          r.status = 'CANCELLED';
          r.cancelled_at = now;
          r.cancel_reason = 'PAYMENT_TIMEOUT';
          expiredIds.push(r.id);
        }
      }
      for (const ri of this.rentalItems) {
        if (expiredIds.includes(ri.rental_id)) {
          ri.blocks_inventory = false;
        }
      }
      return this.ok<R>(
        expiredIds.map((id) => ({ id })),
        expiredIds.length,
      );
    }

    // 10. Payments & Webhooks
    if (sql.startsWith('INSERT INTO payments')) {
      const now = new Date();
      const payment: MemPayment = {
        id: randomUUID(),
        rental_id: String(values[0]),
        gateway: String(values[1]),
        gateway_tx_id: String(values[2]),
        amount: Number(values[3]).toFixed(2),
        payment_method: String(values[4]) as PaymentMethod,
        status: 'PENDING',
        pix_copy_paste: values[5] != null ? String(values[5]) : null,
        invoice_url: values[6] != null ? String(values[6]) : null,
        expires_at: values[7] instanceof Date ? values[7] : values[7] ? new Date(String(values[7])) : null,
        paid_at: null,
        created_at: now,
        updated_at: now,
      };
      this.payments.push(payment);
      return this.ok<R>([payment]);
    }

    if (sql.includes('FROM payments WHERE gateway_tx_id = $1')) {
      const txId = String(values[0] ?? '');
      const found = this.payments
        .filter((p) => p.gateway_tx_id === txId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
      return this.ok<R>(found ? [found] : []);
    }

    if (sql.includes('FROM payments WHERE rental_id = $1::uuid')) {
      const rentalId = String(values[0] ?? '');
      const found = this.payments
        .filter((p) => p.rental_id === rentalId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
      return this.ok<R>(found ? [found] : []);
    }

    if (sql.startsWith('UPDATE payments SET status = $2')) {
      const id = String(values[0] ?? '');
      const status = String(values[1] ?? 'PAID') as PaymentStatus;
      const paidAt = values[2] instanceof Date ? values[2] : values[2] ? new Date(String(values[2])) : null;
      const p = this.payments.find((x) => x.id === id);
      if (p) {
        p.status = status;
        if (paidAt) p.paid_at = paidAt;
        p.updated_at = new Date();
      }
      return this.ok<R>(p ? [p] : []);
    }

    if (sql.startsWith('INSERT INTO payment_webhook_events')) {
      const key = `${values[0]}:${values[1]}`;
      if (this.webhookEvents.has(key)) {
        return this.ok<R>([], 0);
      }
      this.webhookEvents.add(key);
      return this.ok<R>([{ id: randomUUID() }], 1);
    }

    // 11. WhatsApp Sessions
    if (sql.startsWith('INSERT INTO whatsapp_sessions (phone_number, current_state, context_data)')) {
      const phone = String(values[0] ?? '');
      if (!this.whatsappSessions.has(phone)) {
        this.whatsappSessions.set(phone, {
          phone_number: phone,
          client_id: null,
          current_state: 'IDLE',
          context_data: {},
          updated_at: new Date(),
        });
      }
      return this.ok<R>([]);
    }

    if (sql.includes('FROM whatsapp_sessions WHERE phone_number = $1')) {
      const phone = String(values[0] ?? '');
      const s = this.whatsappSessions.get(phone);
      return this.ok<R>(s ? [s] : []);
    }

    if (sql.startsWith('INSERT INTO whatsapp_sessions (phone_number, client_id, current_state, context_data, updated_at)')) {
      const phone = String(values[0] ?? '');
      const clientId = values[1] != null ? String(values[1]) : null;
      const currentState = String(values[2] ?? 'IDLE') as WhatsappSessionState;
      const contextData =
        typeof values[3] === 'string' ? JSON.parse(values[3]) : ((values[3] as WhatsappContextData) ?? {});
      const session: MemWhatsappSession = {
        phone_number: phone,
        client_id: clientId,
        current_state: currentState,
        context_data: contextData,
        updated_at: new Date(),
      };
      this.whatsappSessions.set(phone, session);
      return this.ok<R>([session]);
    }

    return this.ok<R>([]);
  }
}

const memDb = new InMemoryDatabase();

export const inMemoryPool = {
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return memDb.query<R>(text, values);
  },

  async connect() {
    return {
      async query<R extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ): Promise<QueryResult<R>> {
        return memDb.query<R>(text, values);
      },
      release() {
        // no-op
      },
    };
  },

  async end(): Promise<void> {
    // no-op
  },

  on() {
    return this;
  },
};
