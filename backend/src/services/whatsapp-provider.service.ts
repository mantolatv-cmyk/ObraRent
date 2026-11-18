import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { phoneFromJid } from '../lib/phone';

export interface OutboundWhatsappMessage {
  to: string;
  text: string;
  sentAt: string;
  provider: string;
}

export interface InboundWhatsappMessage {
  messageId: string;
  fromPhone: string;
  text: string;
  pushName?: string;
}

export class WhatsappProviderService {
  private readonly outbox: OutboundWhatsappMessage[] = [];

  getOutbox(): readonly OutboundWhatsappMessage[] {
    return this.outbox;
  }

  clearOutbox(): void {
    this.outbox.length = 0;
  }

  async sendText(toPhone: string, text: string): Promise<OutboundWhatsappMessage> {
    const cleanPhone = phoneFromJid(toPhone);
    const record: OutboundWhatsappMessage = {
      to: cleanPhone,
      text,
      sentAt: new Date().toISOString(),
      provider: env.MESSAGING_PROVIDER,
    };

    this.outbox.push(record);
    if (this.outbox.length > 200) {
      this.outbox.shift();
    }

    if (env.MESSAGING_PROVIDER === 'evolution') {
      await this.sendViaEvolution(cleanPhone, text);
    } else if (env.MESSAGING_PROVIDER === 'meta') {
      await this.sendViaMeta(cleanPhone, text);
    } else {
      logger.info({ to: cleanPhone, preview: text.slice(0, 140) }, 'WhatsApp outbound message (console mode)');
    }

    return record;
  }

  private async sendViaEvolution(phone: string, text: string): Promise<void> {
    const base = (env.EVOLUTION_API_URL ?? '').replace(/\/$/, '');
    const instance = env.EVOLUTION_INSTANCE ?? 'default';
    try {
      await axios.post(
        `${base}/message/sendText/${encodeURIComponent(instance)}`,
        {
          number: phone,
          text,
          delay: 200,
        },
        {
          headers: {
            apikey: env.EVOLUTION_API_KEY ?? '',
            'Content-Type': 'application/json',
          },
          timeout: env.HTTP_TIMEOUT_MS,
        },
      );
    } catch (err) {
      logger.error({ err, phone }, 'Failed to send WhatsApp message via Evolution API');
    }
  }

  private async sendViaMeta(phone: string, text: string): Promise<void> {
    const base = env.META_GRAPH_URL.replace(/\/$/, '');
    const phoneNumberId = env.META_PHONE_NUMBER_ID ?? '';
    try {
      await axios.post(
        `${base}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${env.META_ACCESS_TOKEN ?? ''}`,
            'Content-Type': 'application/json',
          },
          timeout: env.HTTP_TIMEOUT_MS,
        },
      );
    } catch (err) {
      logger.error({ err, phone }, 'Failed to send WhatsApp message via Meta Cloud API');
    }
  }

  /**
   * Extracts incoming user text messages from Evolution API (`messages.upsert`),
   * Meta Cloud API (`entry[].changes[].value.messages[]`), or direct webhook JSON
   * (`{ from, phone, text, message }`). Ignores outbound (`fromMe`) and status events.
   */
  extractInboundMessages(payload: unknown): InboundWhatsappMessage[] {
    if (typeof payload !== 'object' || payload === null) return [];
    const body = payload as Record<string, unknown>;
    const results: InboundWhatsappMessage[] = [];

    // 1. Evolution API format: { event: "messages.upsert", data: { key: { remoteJid, fromMe, id }, pushName, message: { conversation | extendedTextMessage: { text } } } }
    if (typeof body.data === 'object' && body.data !== null) {
      const data = body.data as Record<string, unknown>;
      const key = typeof data.key === 'object' && data.key !== null ? (data.key as Record<string, unknown>) : null;
      if (key) {
        if (key.fromMe === true) return [];
        const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
        if (remoteJid.endsWith('@g.us')) return []; // ignore group chats
        const fromPhone = phoneFromJid(remoteJid);
        const msgObj =
          typeof data.message === 'object' && data.message !== null
            ? (data.message as Record<string, unknown>)
            : {};
        const extText =
          typeof msgObj.extendedTextMessage === 'object' && msgObj.extendedTextMessage !== null
            ? (msgObj.extendedTextMessage as Record<string, unknown>).text
            : undefined;
        const text =
          typeof msgObj.conversation === 'string'
            ? msgObj.conversation
            : typeof extText === 'string'
              ? extText
              : typeof data.body === 'string'
                ? data.body
                : '';

        if (fromPhone && text.trim()) {
          results.push({
            messageId: typeof key.id === 'string' ? key.id : `evo:${fromPhone}:${Date.now()}`,
            fromPhone,
            text: text.trim(),
            pushName: typeof data.pushName === 'string' ? data.pushName : undefined,
          });
        }
        return results;
      }
    }

    // 2. Meta Cloud API format: { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [...], contacts: [...] } }] }] }
    if (Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (typeof entry !== 'object' || entry === null) continue;
        const changes = (entry as { changes?: unknown[] }).changes;
        if (!Array.isArray(changes)) continue;
        for (const change of changes) {
          if (typeof change !== 'object' || change === null) continue;
          const value = (change as { value?: Record<string, unknown> }).value;
          if (!value || !Array.isArray(value.messages)) continue;
          const contacts = Array.isArray(value.contacts) ? (value.contacts as Record<string, unknown>[]) : [];
          const pushName =
            typeof contacts[0]?.profile === 'object' && contacts[0]?.profile !== null
              ? ((contacts[0].profile as Record<string, unknown>).name as string | undefined)
              : undefined;

          for (const msg of value.messages as Record<string, unknown>[]) {
            const from = typeof msg.from === 'string' ? phoneFromJid(msg.from) : '';
            const id = typeof msg.id === 'string' ? msg.id : `meta:${from}:${Date.now()}`;
            let text = '';
            if (typeof msg.text === 'object' && msg.text !== null) {
              text = String((msg.text as Record<string, unknown>).body ?? '');
            } else if (typeof msg.interactive === 'object' && msg.interactive !== null) {
              const inter = msg.interactive as Record<string, unknown>;
              const reply = (inter.button_reply ?? inter.list_reply) as Record<string, unknown> | undefined;
              text = String(reply?.id ?? reply?.title ?? '');
            }
            if (from && text.trim()) {
              results.push({ messageId: id, fromPhone: from, text: text.trim(), pushName });
            }
          }
        }
      }
      return results;
    }

    // 3. Direct / simplified payload: { phone | from | phoneNumber, text | message | body, messageId? }
    const rawFrom = body.phone ?? body.from ?? body.phoneNumber ?? body.phone_number;
    const rawText = body.text ?? body.message ?? body.body;
    if (typeof rawFrom === 'string' && typeof rawText === 'string') {
      const fromPhone = phoneFromJid(rawFrom);
      if (fromPhone && rawText.trim()) {
        results.push({
          messageId: typeof body.messageId === 'string' ? body.messageId : `direct:${fromPhone}:${Date.now()}:${Math.random()}`,
          fromPhone,
          text: rawText.trim(),
          pushName: typeof body.pushName === 'string' ? body.pushName : undefined,
        });
      }
    }

    return results;
  }
}

export const whatsappProviderService = new WhatsappProviderService();
