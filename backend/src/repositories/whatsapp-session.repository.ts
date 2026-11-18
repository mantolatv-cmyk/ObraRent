import type { Queryable } from '../db/pool';
import type { WhatsappContextData, WhatsappSession, WhatsappSessionState } from '../types/domain';

interface SessionRow {
  phone_number: string;
  client_id: string | null;
  current_state: WhatsappSessionState;
  context_data: WhatsappContextData;
  updated_at: Date | string;
}

function mapSession(row: SessionRow): WhatsappSession {
  return {
    phoneNumber: row.phone_number,
    clientId: row.client_id,
    currentState: row.current_state,
    contextData: row.context_data ?? {},
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

export class WhatsappSessionRepository {
  async getOrCreate(db: Queryable, phoneNumber: string, forUpdate = false): Promise<WhatsappSession> {
    await db.query(
      `
      INSERT INTO whatsapp_sessions (phone_number, current_state, context_data)
      VALUES ($1, 'IDLE', '{}'::jsonb)
      ON CONFLICT (phone_number) DO NOTHING
      `,
      [phoneNumber],
    );

    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const res = await db.query<SessionRow>(
      `
      SELECT phone_number, client_id, current_state, context_data, updated_at
      FROM whatsapp_sessions
      WHERE phone_number = $1
      ${lockClause}
      `,
      [phoneNumber],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error(`Failed to load WhatsApp session for ${phoneNumber}`);
    }
    return mapSession(row);
  }

  async save(
    db: Queryable,
    input: {
      phoneNumber: string;
      clientId: string | null;
      currentState: WhatsappSessionState;
      contextData: WhatsappContextData;
    },
  ): Promise<WhatsappSession> {
    const res = await db.query<SessionRow>(
      `
      INSERT INTO whatsapp_sessions (phone_number, client_id, current_state, context_data, updated_at)
      VALUES ($1, $2::uuid, $3, $4::jsonb, now())
      ON CONFLICT (phone_number) DO UPDATE SET
        client_id     = EXCLUDED.client_id,
        current_state = EXCLUDED.current_state,
        context_data  = EXCLUDED.context_data,
        updated_at    = now()
      RETURNING phone_number, client_id, current_state, context_data, updated_at
      `,
      [input.phoneNumber, input.clientId, input.currentState, JSON.stringify(input.contextData ?? {})],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error(`Failed to save WhatsApp session for ${input.phoneNumber}`);
    }
    return mapSession(row);
  }

  async resetToIdle(
    db: Queryable,
    phoneNumber: string,
    clientId: string | null = null,
    preservedContext: Partial<WhatsappContextData> = {},
  ): Promise<WhatsappSession> {
    return this.save(db, {
      phoneNumber,
      clientId,
      currentState: 'IDLE',
      contextData: preservedContext,
    });
  }
}

export const whatsappSessionRepository = new WhatsappSessionRepository();
