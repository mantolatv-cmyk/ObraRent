import express from 'express';
const { Router } = express;
import { env } from '../config/env';
import { pool } from '../db/pool';
import { UnauthorizedError, ValidationError } from '../lib/errors';
import { phoneFromJid } from '../lib/phone';
import { whatsappSessionRepository } from '../repositories/whatsapp-session.repository';
import { rentalService } from '../services/rental.service';
import { whatsappBotService } from '../services/whatsapp-bot.service';
import { whatsappProviderService } from '../services/whatsapp-provider.service';

export const webhooksRouter = Router();

/** Meta Cloud API webhook verification challenge (`GET /api/v1/webhooks/whatsapp`). */
webhooksRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && (!env.META_VERIFY_TOKEN || token === env.META_VERIFY_TOKEN)) {
    res.status(200).send(String(challenge ?? ''));
    return;
  }
  throw new UnauthorizedError('Verificação de webhook Meta falhou.');
});

/**
 * Inspects a WhatsApp session state & recent outbound messages for the interactive
 * web simulator (`GET /api/v1/webhooks/whatsapp/session/:phone`).
 */
webhooksRouter.get('/whatsapp/session/:phone', async (req, res) => {
  const cleanPhone = phoneFromJid(req.params.phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new ValidationError('Número de telefone inválido.');
  }
  const session = await whatsappSessionRepository.getOrCreate(pool, cleanPhone);
  const outbox = whatsappProviderService.getOutbox().filter((m) => m.to === cleanPhone);
  res.json({ data: { session, outbox } });
});

/**
 * Resets a WhatsApp session to IDLE (`POST /api/v1/webhooks/whatsapp/reset`).
 */
webhooksRouter.post('/whatsapp/reset', async (req, res) => {
  const body = (req.body ?? {}) as { phone?: unknown };
  const cleanPhone = phoneFromJid(String(body.phone ?? ''));
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new ValidationError('Informe um telefone válido para reiniciar a sessão.');
  }
  const session = await whatsappSessionRepository.resetToIdle(pool, cleanPhone);
  res.json({ data: { session } });
});

/**
 * WhatsApp State Machine Bot webhook (`POST /api/v1/webhooks/whatsapp`).
 * Supports Evolution API (`messages.upsert`), Meta Cloud API, and direct JSON payloads.
 */
webhooksRouter.post('/whatsapp', async (req, res) => {
  if (env.WHATSAPP_WEBHOOK_TOKEN) {
    const headerToken = req.headers['x-webhook-token'] ?? req.headers['apikey'];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (token !== env.WHATSAPP_WEBHOOK_TOKEN) {
      throw new UnauthorizedError('Token de webhook do WhatsApp inválido.');
    }
  }

  const replies = await whatsappBotService.handleWebhookPayload(req.body);
  res.status(200).json({
    data: {
      processedCount: replies.length,
      replies,
    },
  });
});

/**
 * Payment Gateway webhook (`POST /api/v1/webhooks/gateway`).
 * Listens for payment approval events (Asaas, Pagar.me, or direct webhook),
 * updates payment status to PAID, confirms the rental, assigns physical assets,
 * and triggers automated WhatsApp confirmation to the contractor.
 */
webhooksRouter.post('/gateway', async (req, res) => {
  const result = await rentalService.handleGatewayWebhook(req.body, req.headers);
  res.status(200).json({ data: result });
});
