import type { Queryable } from '../db/pool';
import type { Client } from '../types/domain';

export interface ClientRow {
  id: string;
  cnpj: string;
  company_name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  password_hash?: string | null;
  created_at: Date | string;
}

export interface ClientWithAuth extends Client {
  passwordHash?: string | null;
}

const CLIENT_COLUMNS = `id, cnpj, company_name, trade_name, email, phone, created_at`;
const CLIENT_COLUMNS_WITH_AUTH = `id, cnpj, company_name, trade_name, email, phone, password_hash, created_at`;

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    cnpj: row.cnpj.trim(),
    companyName: row.company_name,
    tradeName: row.trade_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

function mapClientWithAuth(row: ClientRow): ClientWithAuth {
  return {
    ...mapClient(row),
    passwordHash: row.password_hash ?? null,
  };
}

export class ClientRepository {
  async findByCnpj(db: Queryable, cnpj: string): Promise<Client | null> {
    const res = await db.query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS}
       FROM clients
       WHERE cnpj = $1`,
      [cnpj],
    );
    const row = res.rows[0];
    return row ? mapClient(row) : null;
  }

  async findByCnpjWithAuth(db: Queryable, cnpj: string): Promise<ClientWithAuth | null> {
    const res = await db.query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS_WITH_AUTH}
       FROM clients
       WHERE cnpj = $1`,
      [cnpj],
    );
    const row = res.rows[0];
    return row ? mapClientWithAuth(row) : null;
  }

  async findByEmailWithAuth(db: Queryable, email: string): Promise<ClientWithAuth | null> {
    const res = await db.query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS_WITH_AUTH}
       FROM clients
       WHERE lower(email) = lower($1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.trim()],
    );
    const row = res.rows[0];
    return row ? mapClientWithAuth(row) : null;
  }

  async findById(db: Queryable, id: string): Promise<Client | null> {
    const res = await db.query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS}
       FROM clients
       WHERE id = $1::uuid`,
      [id],
    );
    const row = res.rows[0];
    return row ? mapClient(row) : null;
  }

  async findByPhone(db: Queryable, phone: string): Promise<Client | null> {
    const res = await db.query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS}
       FROM clients
       WHERE phone = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone],
    );
    const row = res.rows[0];
    return row ? mapClient(row) : null;
  }

  async upsertByCnpj(
    db: Queryable,
    input: {
      cnpj: string;
      companyName: string;
      tradeName?: string | null;
      email?: string | null;
      phone?: string | null;
    },
  ): Promise<Client> {
    const res = await db.query<ClientRow>(
      `
      INSERT INTO clients (cnpj, company_name, trade_name, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cnpj) DO UPDATE SET
        company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), clients.company_name),
        trade_name   = COALESCE(EXCLUDED.trade_name, clients.trade_name),
        email        = COALESCE(EXCLUDED.email, clients.email),
        phone        = COALESCE(EXCLUDED.phone, clients.phone),
        updated_at   = now()
      RETURNING ${CLIENT_COLUMNS}
      `,
      [
        input.cnpj,
        input.companyName,
        input.tradeName ?? null,
        input.email ?? null,
        input.phone ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to upsert client record');
    }
    return mapClient(row);
  }

  async upsertWithPassword(
    db: Queryable,
    input: {
      cnpj: string;
      companyName: string;
      tradeName?: string | null;
      email: string;
      phone?: string | null;
      passwordHash: string;
    },
  ): Promise<Client> {
    const res = await db.query<ClientRow>(
      `
      INSERT INTO clients (cnpj, company_name, trade_name, email, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (cnpj) DO UPDATE SET
        company_name  = COALESCE(NULLIF(EXCLUDED.company_name, ''), clients.company_name),
        trade_name    = COALESCE(EXCLUDED.trade_name, clients.trade_name),
        email         = COALESCE(EXCLUDED.email, clients.email),
        phone         = COALESCE(EXCLUDED.phone, clients.phone),
        password_hash = EXCLUDED.password_hash,
        updated_at    = now()
      RETURNING ${CLIENT_COLUMNS}
      `,
      [
        input.cnpj,
        input.companyName,
        input.tradeName ?? null,
        input.email,
        input.phone ?? null,
        input.passwordHash,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to upsert client with password');
    }
    return mapClient(row);
  }
}

export const clientRepository = new ClientRepository();
