import { env } from '../config/env';
import { withTransaction } from '../db/transaction';
import { BoundedSet } from '../lib/bounded-set';
import { isValidCnpj, onlyDigits } from '../lib/cnpj';
import { addDays, buildIsoDate, compareIso, formatBrDate, isValidIsoDate, rentalDays, todayIso } from '../lib/dates';
import { InsufficientAvailabilityError } from '../lib/errors';
import { formatBRL } from '../lib/money';
import { clientRepository } from '../repositories/client.repository';
import { equipmentRepository } from '../repositories/equipment.repository';
import { whatsappSessionRepository } from '../repositories/whatsapp-session.repository';
import type {
  DeliveryAddress,
  WhatsappContextData,
  WhatsappMenuCategory,
  WhatsappSessionState,
} from '../types/domain';
import { externalLookupService } from './cnpj-lookup.service';
import { rentalService } from './rental.service';
import { extractIntentFromText, whatsappAiService } from './whatsapp-ai.service';
import { whatsappProviderService, type InboundWhatsappMessage } from './whatsapp-provider.service';

const TRIGGER_KEYWORDS = [
  'alugar',
  'preciso',
  'locar',
  'locacao',
  'locação',
  'orcamento',
  'orçamento',
  'catalogo',
  'catálogo',
  'equipamento',
  'maquina',
  'máquina',
  'oi',
  'ola',
  'olá',
  'menu',
  'iniciar',
];

const RESET_KEYWORDS = ['cancelar', 'sair', 'reiniciar', 'voltar', 'reset', '0'];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Generates a valid 14-digit CNPJ deterministically from an 8-digit root so
 * first-time WhatsApp contractors who don't type a CNPJ can still complete the
 * self-service checkout flow without friction.
 */
export function buildValidCnpjFromSeed(seedDigits: string): string {
  const root = onlyDigits(seedDigits).padStart(8, '1').slice(-8);
  const base12 = `${root}0001`;
  const digits = base12.split('').map(Number);

  const calc = (weights: number[], arr: number[]): number => {
    const sum = weights.reduce((acc, w, i) => acc + w * (arr[i] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], digits);
  digits.push(d1);
  const d2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], digits);
  return `${base12}${d1}${d2}`;
}

/**
 * Parses natural-language date or duration inputs in pt-BR:
 *  - "2026-11-20 a 2026-11-25"
 *  - "20/11/2026 a 25/11/2026" or "20/11 a 25/11"
 *  - "20/11 por 5 dias"
 *  - "amanha 3 dias" / "hoje 5 dias" / "7 dias" / "7"
 */
export function parseWhatsappDateInput(
  rawText: string,
  referenceIso: string = todayIso(),
): { startDate: string; endDate: string; days: number } | null {
  const text = normalizeText(rawText);

  // 1. Two ISO dates: YYYY-MM-DD ... YYYY-MM-DD
  const isoMatches = text.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
  if (isoMatches && isoMatches.length >= 2) {
    const start = isoMatches[0]!;
    const end = isoMatches[1]!;
    if (isValidIsoDate(start) && isValidIsoDate(end) && compareIso(end, start) >= 0) {
      return { startDate: start, endDate: end, days: rentalDays(start, end) };
    }
  }

  // 2. Two BR dates: DD/MM(/YYYY) ... DD/MM(/YYYY)
  const brRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
  const brMatches = Array.from(text.matchAll(brRegex));
  if (brMatches.length >= 2) {
    const m1 = brMatches[0]!;
    const m2 = brMatches[1]!;
    const start = buildIsoDate(
      Number(m1[1]),
      Number(m1[2]),
      m1[3] ? Number(m1[3]) : undefined,
      referenceIso,
    );
    const end = buildIsoDate(
      Number(m2[1]),
      Number(m2[2]),
      m2[3] ? Number(m2[3]) : undefined,
      start ?? referenceIso,
    );
    if (start && end && compareIso(end, start) >= 0) {
      return { startDate: start, endDate: end, days: rentalDays(start, end) };
    }
  }

  // 3. Single date + duration ("20/11 por 5 dias" or "2026-11-20 5 dias")
  const durationMatch = text.match(/(\d{1,3})\s*(?:dia|dias|d)\b/) ?? text.match(/^\s*(\d{1,3})\s*$/);
  const durationDays = durationMatch ? Number.parseInt(durationMatch[1]!, 10) : null;

  if (brMatches.length === 1) {
    const m1 = brMatches[0]!;
    const start = buildIsoDate(
      Number(m1[1]),
      Number(m1[2]),
      m1[3] ? Number(m1[3]) : undefined,
      referenceIso,
    );
    if (start) {
      const days = durationDays && durationDays > 0 ? durationDays : 1;
      const end = addDays(start, days - 1);
      return { startDate: start, endDate: end, days };
    }
  }

  if (isoMatches && isoMatches.length === 1) {
    const start = isoMatches[0]!;
    if (isValidIsoDate(start)) {
      const days = durationDays && durationDays > 0 ? durationDays : 1;
      const end = addDays(start, days - 1);
      return { startDate: start, endDate: end, days };
    }
  }

  // 4. Relative duration ("5 dias", "amanha por 3 dias", "hoje 2 dias", "7")
  if (durationDays && durationDays > 0 && durationDays <= env.MAX_RENTAL_DAYS) {
    const startsToday = /\bhoje\b/.test(text);
    const startDate = startsToday ? referenceIso : addDays(referenceIso, 1);
    const endDate = addDays(startDate, durationDays - 1);
    return { startDate, endDate, days: durationDays };
  }

  return null;
}

/**
 * Parses a free-form construction site address line into a structured
 * `DeliveryAddress` (extracting CEP, number, UF, and optional CNPJ if present).
 */
export async function parseWhatsappAddressInput(rawText: string): Promise<{
  address: DeliveryAddress;
  extractedCnpj: string | null;
}> {
  let text = rawText.trim();

  // Check if user also included a 14-digit CNPJ in the message
  let extractedCnpj: string | null = null;
  const cnpjMatch = text.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (cnpjMatch?.[1]) {
    const candidate = onlyDigits(cnpjMatch[1]);
    if (isValidCnpj(candidate)) {
      extractedCnpj = candidate;
      text = text.replace(cnpjMatch[0], '').trim();
    }
  }

  // Extract 8-digit CEP if present
  const cepMatch = text.match(/\b(\d{5})-?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : env.DEPOT_CEP;
  const cleanedText = text.replace(/\b\d{5}-?\d{3}\b/, '').replace(/^[,;\-\s]+|[,;\-\s]+$/g, '').trim();

  let viaCep = {
    street: 'Rua da Obra',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
  };
  if (cepMatch) {
    try {
      const lookedUp = await externalLookupService.lookupCep(cep);
      viaCep = {
        street: lookedUp.street || viaCep.street,
        district: lookedUp.district || viaCep.district,
        city: lookedUp.city || viaCep.city,
        state: lookedUp.state || viaCep.state,
      };
    } catch {
      // Keep default fallback
    }
  }

  // Extract number (e.g. "nº 500", ", 500", "1200")
  const numberMatch =
    cleanedText.match(/(?:n[º°o]?|numero|número|,)\s*(\d{1,6}[A-Za-z]?)\b/i) ??
    cleanedText.match(/\b(\d{1,5})\b/);
  const number = numberMatch?.[1] ?? 'S/N';

  // Extract UF if present (e.g. "- SP" or "/RJ")
  const ufMatch = cleanedText.match(/(?:\/|\s-\s|,\s*)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  const state = ufMatch?.[1]?.toUpperCase() ?? viaCep.state;

  const streetPart = cleanedText.split(',')[0]?.trim();
  const street = streetPart && streetPart.length >= 3 ? streetPart : viaCep.street;

  return {
    address: {
      cep,
      street,
      number,
      district: viaCep.district,
      city: viaCep.city,
      state,
      reference: rawText.trim().slice(0, 140),
    },
    extractedCnpj,
  };
}

export interface WhatsappBotReply {
  phoneNumber: string;
  previousState: string;
  nextState: string;
  replyText: string;
  rentalId?: string;
}

export class WhatsappBotService {
  private readonly seenMessageIds = new BoundedSet<string>(1000);

  async handleWebhookPayload(payload: unknown): Promise<WhatsappBotReply[]> {
    const messages = whatsappProviderService.extractInboundMessages(payload);
    const replies: WhatsappBotReply[] = [];

    for (const msg of messages) {
      if (!this.seenMessageIds.add(msg.messageId)) {
        continue;
      }
      const reply = await this.processInboundMessage(msg);
      replies.push(reply);
    }

    return replies;
  }

  async processInboundMessage(msg: InboundWhatsappMessage): Promise<WhatsappBotReply> {
    const norm = normalizeText(msg.text);

    // Load or initialize session inside a transaction and determine response
    const stepResult = await withTransaction(async (tx) => {
      const session = await whatsappSessionRepository.getOrCreate(tx, msg.fromPhone, true);
      const previousState = session.currentState;

      // Global reset escape hatch from non-IDLE states
      if (previousState !== 'IDLE' && RESET_KEYWORDS.includes(norm)) {
        await whatsappSessionRepository.resetToIdle(tx, msg.fromPhone, session.clientId);
        return {
          previousState,
          nextState: 'IDLE' as const,
          replyText:
            '🔄 Atendimento reiniciado. Quando quiser fazer uma nova locação ou tirar dúvidas sobre equipamentos, envie sua mensagem!',
        };
      }

      // Check session inactivity timeout
      const ageMinutes = (Date.now() - new Date(session.updatedAt).getTime()) / 60_000;
      const effectiveState =
        previousState !== 'IDLE' && ageMinutes > env.WHATSAPP_SESSION_TIMEOUT_MINUTES
          ? 'IDLE'
          : previousState;

      // 1. Direct Q&A check — answers user questions directly in natural language
      const directAnswer = await whatsappAiService.answerDirectQuestion(msg.text, session.contextData, tx);
      if (directAnswer) {
        if (effectiveState === 'IDLE') {
          return {
            previousState,
            nextState: 'IDLE' as const,
            replyText: directAnswer,
          };
        }

        // If user already had an active rental flow, answer directly and provide seamless resumption
        let reminder = '';
        if (effectiveState === 'AWAITING_CATEGORY') {
          reminder = '\n\n---\n📌 *Continuando seu pedido:* Qual equipamento você gostaria de alugar? (Você pode digitar o nome ou o número da opção).';
        } else if (effectiveState === 'AWAITING_DATES') {
          reminder = `\n\n---\n📌 *Continuando seu pedido:* Estávamos definindo o período para *${session.contextData.selectedCategoryName}*. Por quantos dias você precisa?`;
        } else if (effectiveState === 'AWAITING_ADDRESS') {
          reminder = `\n\n---\n📌 *Continuando seu pedido:* Para finalizarmos a reserva de *${session.contextData.selectedCategoryName}*, qual o endereço completo e CEP da obra?`;
        }

        return {
          previousState,
          nextState: effectiveState as WhatsappSessionState,
          replyText: directAnswer + reminder,
        };
      }

      // 2. Dynamic Natural Language Order / Intent Extraction
      const intent = await extractIntentFromText(msg.text, session.contextData);
      if (intent.equipment && effectiveState !== 'AWAITING_ADDRESS') {
        const categories = await equipmentRepository.listCategories(tx);
        const cat = categories.find((c) => c.slug === intent.equipment!.slug);

        if (cat) {
          // If message contains ALL fields (equipment + dates + address) -> ONE-SHOT checkout!
          if (intent.hasAllFields && intent.dates && intent.address) {
            const contextData: WhatsappContextData = {
              ...session.contextData,
              selectedCategoryId: cat.id,
              selectedCategoryName: cat.name,
              selectedQuantity: intent.quantity,
              dailyRate: cat.baseDailyRate,
              startDate: intent.dates.startDate,
              endDate: intent.dates.endDate,
              days: intent.dates.days,
              deliveryAddress: intent.address.address,
              cnpj: intent.address.extractedCnpj ?? undefined,
              companyName: msg.pushName,
            };

            return {
              previousState,
              nextState: 'AWAITING_ADDRESS' as const,
              deferAddressCheckout: {
                clientId: session.clientId,
                contextData,
              },
              replyText: '',
            };
          }

          // If message contains equipment + dates (e.g. "Quero 2 marteletes por 5 dias")
          if (intent.dates && (effectiveState === 'IDLE' || effectiveState === 'AWAITING_CATEGORY' || effectiveState === 'AWAITING_DATES')) {
            const avail = await equipmentRepository.getAvailability(tx, {
              startDate: intent.dates.startDate,
              endDate: intent.dates.endDate,
              categoryId: cat.id,
            });
            const catAvail = avail[0];
            const availableCount = catAvail?.availableCount ?? 0;

            if (availableCount < intent.quantity) {
              return {
                previousState,
                nextState: 'AWAITING_DATES' as const,
                replyText: [
                  `⚠️ Para o período de *${formatBrDate(intent.dates.startDate)} a ${formatBrDate(intent.dates.endDate)}*, temos *${availableCount}* unidade(s) de *${cat.name}* (você solicitou ${intent.quantity}).`,
                  ``,
                  `Por favor, informe outra data ou ajuste a quantidade para prosseguirmos:`,
                ].join('\n'),
              };
            }

            const updatedContext: WhatsappContextData = {
              ...session.contextData,
              selectedCategoryId: cat.id,
              selectedCategoryName: cat.name,
              selectedQuantity: intent.quantity,
              dailyRate: cat.baseDailyRate,
              startDate: intent.dates.startDate,
              endDate: intent.dates.endDate,
              days: intent.dates.days,
              companyName: msg.pushName,
            };

            await whatsappSessionRepository.save(tx, {
              phoneNumber: msg.fromPhone,
              clientId: session.clientId,
              currentState: 'AWAITING_ADDRESS',
              contextData: updatedContext,
            });

            return {
              previousState,
              nextState: 'AWAITING_ADDRESS' as const,
              replyText: [
                `✅ Perfeito! *${intent.quantity}x ${cat.name}* (${formatBRL(cat.baseDailyRate)}/dia cada) selecionado para o período de *${formatBrDate(intent.dates.startDate)} a ${formatBrDate(intent.dates.endDate)}* (*${intent.dates.days} dia(s)*) — ${availableCount} un. disponíveis.`,
                ``,
                `📍 *Qual o endereço completo com CEP da obra para entrega e cálculo do frete?*`,
                `_(Ex.: Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100)_`,
              ].join('\n'),
            };
          }

          // If message only specifies equipment and user was in IDLE (e.g. "Quero alugar um martelete 10kg")
          if (effectiveState === 'IDLE') {
            const updatedContext: WhatsappContextData = {
              ...session.contextData,
              selectedCategoryId: cat.id,
              selectedCategoryName: cat.name,
              selectedQuantity: intent.quantity,
              dailyRate: cat.baseDailyRate,
              companyName: msg.pushName,
            };

            await whatsappSessionRepository.save(tx, {
              phoneNumber: msg.fromPhone,
              clientId: session.clientId,
              currentState: 'AWAITING_DATES',
              contextData: updatedContext,
            });

            return {
              previousState,
              nextState: 'AWAITING_DATES' as const,
              replyText: [
                `✅ Ótima escolha! Selecionado: *${intent.quantity}x ${cat.name}* (${formatBRL(cat.baseDailyRate)}/dia cada).`,
                ``,
                `📅 *Por quantos dias ou qual o período da locação?*`,
                `Você pode responder:`,
                `• Quantidade de dias (ex.: *5 dias* ou *7*)`,
                `• Data inicial e final (ex.: *20/11 a 25/11* ou *amanhã até sexta*)`,
              ].join('\n'),
            };
          }
        }
      }

      if (effectiveState === 'IDLE') {
        return this.handleIdleState(tx, msg, session.clientId);
      }

      if (effectiveState === 'AWAITING_CATEGORY') {
        return this.handleAwaitingCategoryState(tx, msg, session.clientId, session.contextData);
      }

      if (effectiveState === 'AWAITING_DATES') {
        return this.handleAwaitingDatesState(tx, msg, session.clientId, session.contextData);
      }

      if (effectiveState === 'AWAITING_ADDRESS') {
        return {
          previousState,
          nextState: 'AWAITING_ADDRESS' as const,
          deferAddressCheckout: {
            clientId: session.clientId,
            contextData: session.contextData,
          },
          replyText: '',
        };
      }

      // AWAITING_PAYMENT or fallback -> return to IDLE or start menu
      return this.handleIdleState(tx, msg, session.clientId);
    });

    // Address step performs full rental creation + Pix generation and then resets session to IDLE
    if ('deferAddressCheckout' in stepResult && stepResult.deferAddressCheckout) {
      const checkoutResult = await this.handleAwaitingAddressCheckout(
        msg,
        stepResult.previousState,
        stepResult.deferAddressCheckout.clientId,
        stepResult.deferAddressCheckout.contextData,
      );
      await whatsappProviderService.sendText(msg.fromPhone, checkoutResult.replyText);
      return checkoutResult;
    }

    await whatsappProviderService.sendText(msg.fromPhone, stepResult.replyText);
    return {
      phoneNumber: msg.fromPhone,
      previousState: stepResult.previousState,
      nextState: stepResult.nextState,
      replyText: stepResult.replyText,
    };
  }

  private async handleIdleState(
    tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
    msg: InboundWhatsappMessage,
    clientId: string | null,
  ) {
    const norm = normalizeText(msg.text);
    const isTriggered = TRIGGER_KEYWORDS.some((kw) => norm.includes(kw));

    const categories = await equipmentRepository.listCategories(tx);
    const menuCategories: WhatsappMenuCategory[] = categories.map((c, idx) => ({
      index: idx + 1,
      id: c.id,
      name: c.name,
      dailyRate: c.baseDailyRate,
    }));

    if (!isTriggered) {
      return {
        previousState: 'IDLE' as const,
        nextState: 'IDLE' as const,
        replyText: [
          `👷 Olá${msg.pushName ? `, *${msg.pushName}*` : ''}! Bem-vindo à *Mantovani* — locação expressa e inteligente de equipamentos para construção civil.`,
          ``,
          `Como posso te ajudar hoje?`,
          `• ❓ *Tirar dúvidas:* Pode me perguntar diretamente qualquer coisa (ex.: *"Quanto custa o martelete?"*, *"Qual a diferença entre sapo e placa?"* ou *"Qual máquina para quebrar laje?"*)`,
          `• 🚚 *Frete & Prazos:* Pergunte sobre entrega e valores (ex.: *"Quanto é o frete para o CEP 01310-100?"*)`,
          `• ⚡ *Alugar direto:* Você pode pedir em linguagem natural (ex.: *"Quero um martelete por 5 dias"* ou enviar *alugar* para ver o catálogo completo com opções numeradas!).`,
        ].join('\n'),
      };
    }

    const menuLines = menuCategories
      .map((c) => `*${c.index}.* ${c.name} — *${formatBRL(c.dailyRate)}/dia*`)
      .join('\n');

    const contextData: WhatsappContextData = {
      menuCategories,
      companyName: msg.pushName,
    };

    await whatsappSessionRepository.save(tx, {
      phoneNumber: msg.fromPhone,
      clientId,
      currentState: 'AWAITING_CATEGORY',
      contextData,
    });

    const replyText = [
      `🏗️ *Mantovani — Catálogo de Equipamentos*`,
      `Escolha o equipamento enviando o *número* da opção (ex.: *1* ou *1 x2* para 2 unidades):`,
      ``,
      menuLines,
      ``,
      `_Envie *cancelar* a qualquer momento para sair._`,
    ].join('\n');

    return {
      previousState: 'IDLE' as const,
      nextState: 'AWAITING_CATEGORY' as const,
      replyText,
    };
  }

  private async handleAwaitingCategoryState(
    tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
    msg: InboundWhatsappMessage,
    clientId: string | null,
    contextData: WhatsappContextData,
  ) {
    let menu = contextData.menuCategories;
    if (!menu || menu.length === 0) {
      const categories = await equipmentRepository.listCategories(tx);
      menu = categories.map((c, idx) => ({
        index: idx + 1,
        id: c.id,
        name: c.name,
        dailyRate: c.baseDailyRate,
      }));
    }

    const text = msg.text.trim();
    // Parse "1", "1 x3", "2 unidades do 1", or match by category name
    const optionMatch = text.match(/^\s*(\d{1,2})(?:\s*[xX*]\s*(\d{1,2})|\s+(\d{1,2})\s*(?:un|unid|unidades|pecas|peças|modulos|módulos))?\s*$/i);

    let chosen: WhatsappMenuCategory | undefined;
    let quantity = 1;

    if (optionMatch) {
      const idx = Number.parseInt(optionMatch[1]!, 10);
      chosen = menu.find((m) => m.index === idx);
      const qtyRaw = optionMatch[2] ?? optionMatch[3];
      if (qtyRaw) {
        quantity = Math.max(1, Math.min(50, Number.parseInt(qtyRaw, 10)));
      }
    } else {
      const norm = normalizeText(text);
      chosen = menu.find((m) => normalizeText(m.name).includes(norm) || norm.includes(normalizeText(m.name).split(' ')[0] ?? '___'));
      const qtyMatch = norm.match(/(\d{1,2})\s*(?:un|unid|unidades|x)/);
      if (qtyMatch?.[1]) {
        quantity = Math.max(1, Math.min(50, Number.parseInt(qtyMatch[1], 10)));
      }
    }

    if (!chosen) {
      const menuLines = menu.map((c) => `*${c.index}.* ${c.name} (${formatBRL(c.dailyRate)}/dia)`).join('\n');
      return {
        previousState: 'AWAITING_CATEGORY' as const,
        nextState: 'AWAITING_CATEGORY' as const,
        replyText: [
          `⚠️ Opção inválida. Digite apenas o *número* do equipamento (de *1* a *${menu.length}*):`,
          ``,
          menuLines,
        ].join('\n'),
      };
    }

    const updatedContext: WhatsappContextData = {
      ...contextData,
      menuCategories: menu,
      selectedCategoryId: chosen.id,
      selectedCategoryName: chosen.name,
      selectedQuantity: quantity,
      dailyRate: chosen.dailyRate,
    };

    await whatsappSessionRepository.save(tx, {
      phoneNumber: msg.fromPhone,
      clientId,
      currentState: 'AWAITING_DATES',
      contextData: updatedContext,
    });

    const replyText = [
      `✅ Selecionado: *${quantity}x ${chosen.name}* (${formatBRL(chosen.dailyRate)}/dia cada).`,
      ``,
      `📅 *Por quantos dias ou qual o período da locação?*`,
      `Você pode responder:`,
      `• Quantidade de dias (ex.: *5 dias* ou *7*)`,
      `• Data inicial e final (ex.: *20/11 a 25/11* ou *2026-11-20 a 2026-11-25*)`,
    ].join('\n');

    return {
      previousState: 'AWAITING_CATEGORY' as const,
      nextState: 'AWAITING_DATES' as const,
      replyText,
    };
  }

  private async handleAwaitingDatesState(
    tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
    msg: InboundWhatsappMessage,
    clientId: string | null,
    contextData: WhatsappContextData,
  ) {
    const parsed = parseWhatsappDateInput(msg.text);
    if (!parsed) {
      return {
        previousState: 'AWAITING_DATES' as const,
        nextState: 'AWAITING_DATES' as const,
        replyText: [
          `⚠️ Não consegui identificar o período.`,
          `Informe a quantidade de dias (ex.: *5 dias*) ou as datas (ex.: *20/11 a 25/11*).`,
        ].join('\n'),
      };
    }

    const categoryId = contextData.selectedCategoryId!;
    const quantity = contextData.selectedQuantity ?? 1;
    const availability = await equipmentRepository.getAvailability(tx, {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      categoryId,
    });
    const catAvail = availability[0];
    const availableCount = catAvail?.availableCount ?? 0;

    if (availableCount < quantity) {
      return {
        previousState: 'AWAITING_DATES' as const,
        nextState: 'AWAITING_DATES' as const,
        replyText: [
          `⚠️ Para o período de *${formatBrDate(parsed.startDate)} a ${formatBrDate(parsed.endDate)}*, temos *${availableCount}* unidade(s) disponível(is) de *${contextData.selectedCategoryName}* (você solicitou ${quantity}).`,
          ``,
          `Por favor, informe outra data ou período:`,
        ].join('\n'),
      };
    }

    const updatedContext: WhatsappContextData = {
      ...contextData,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      days: parsed.days,
    };

    await whatsappSessionRepository.save(tx, {
      phoneNumber: msg.fromPhone,
      clientId,
      currentState: 'AWAITING_ADDRESS',
      contextData: updatedContext,
    });

    const replyText = [
      `📅 Período confirmado: *${formatBrDate(parsed.startDate)} a ${formatBrDate(parsed.endDate)}* (*${parsed.days} dia(s)*) — ${availableCount} un. disponíveis.`,
      ``,
      `📍 *Qual o endereço completo da obra para entrega?*`,
      `Envie rua, número, bairro/cidade e CEP (ex.: *Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100*).`,
      `_Opcional: inclua o CNPJ da construtora na mesma mensagem._`,
    ].join('\n');

    return {
      previousState: 'AWAITING_DATES' as const,
      nextState: 'AWAITING_ADDRESS' as const,
      replyText,
    };
  }

  private async handleAwaitingAddressCheckout(
    msg: InboundWhatsappMessage,
    previousState: string,
    sessionClientId: string | null,
    contextData: WhatsappContextData,
  ): Promise<WhatsappBotReply> {
    if (msg.text.trim().length < 5) {
      return {
        phoneNumber: msg.fromPhone,
        previousState,
        nextState: 'AWAITING_ADDRESS',
        replyText:
          '⚠️ Endereço muito curto. Informe rua, número, cidade e CEP da obra (ex.: *Av. Paulista, 1000, São Paulo - SP, 01310-100*).',
      };
    }

    const { address, extractedCnpj } = await parseWhatsappAddressInput(msg.text);

    // Resolve client CNPJ: extracted in message -> linked client -> lookup by phone -> deterministic valid CNPJ
    let cnpj = extractedCnpj ?? contextData.cnpj ?? null;
    let companyName = contextData.companyName ?? msg.pushName ?? undefined;

    if (!cnpj && sessionClientId) {
      const existingById = await clientRepository.findById(
        await import('../db/pool').then((m) => m.pool),
        sessionClientId,
      );
      if (existingById) {
        cnpj = existingById.cnpj;
        companyName = existingById.companyName;
      }
    }
    if (!cnpj) {
      const existingByPhone = await clientRepository.findByPhone(
        await import('../db/pool').then((m) => m.pool),
        msg.fromPhone,
      );
      if (existingByPhone) {
        cnpj = existingByPhone.cnpj;
        companyName = existingByPhone.companyName;
      }
    }
    if (!cnpj) {
      cnpj = buildValidCnpjFromSeed(msg.fromPhone);
    }

    try {
      const summary = await rentalService.createRental({
        client: {
          cnpj,
          companyName: companyName ? `${companyName}` : undefined,
          phone: msg.fromPhone,
        },
        startDate: contextData.startDate!,
        endDate: contextData.endDate!,
        items: [
          {
            categoryId: contextData.selectedCategoryId!,
            quantity: contextData.selectedQuantity ?? 1,
          },
        ],
        deliveryAddress: address,
        paymentMethod: 'PIX',
        channel: 'WHATSAPP',
        contactPhone: msg.fromPhone,
      });

      await withTransaction((tx) =>
        whatsappSessionRepository.resetToIdle(tx, msg.fromPhone, summary.client.id, {
          lastRentalId: summary.id,
          lastRentalCode: summary.code,
          cnpj: summary.client.cnpj,
          companyName: summary.client.companyName,
        }),
      );

      const assetTags = summary.items.map((i) => i.assetTag).join(', ');
      const pixCode = summary.payment?.pixCopyPaste ?? '';
      const replyText = [
        `🧾 *Pedido gerado com sucesso! Contrato ${summary.code}*`,
        ``,
        `• *Equipamento:* ${contextData.selectedQuantity ?? 1}x ${contextData.selectedCategoryName} (Patrimônio: *${assetTags}*)`,
        `• *Período:* ${formatBrDate(summary.startDate)} a ${formatBrDate(summary.endDate)} (${summary.days} dia(s))`,
        `• *Entrega:* ${address.street}, ${address.number} — ${address.city}/${address.state} (CEP ${address.cep})`,
        `• *Subtotal equipamentos:* ${formatBRL(summary.subtotal)}`,
        `• *Frete (${summary.freight.zone}):* ${formatBRL(summary.freight.amount)}`,
        `• *Total a pagar:* *${formatBRL(summary.totalAmount)}*`,
        ``,
        `⚡ *Pague via Pix Copia e Cola abaixo para liberar o envio imediato:*`,
        ``,
        `${pixCode}`,
        ``,
        `Assim que o pagamento for identificado, enviaremos a confirmação automática aqui no WhatsApp.`,
      ].join('\n');

      return {
        phoneNumber: msg.fromPhone,
        previousState,
        nextState: 'IDLE',
        replyText,
        rentalId: summary.id,
      };
    } catch (err) {
      if (err instanceof InsufficientAvailabilityError) {
        await withTransaction((tx) =>
          whatsappSessionRepository.save(tx, {
            phoneNumber: msg.fromPhone,
            clientId: sessionClientId,
            currentState: 'AWAITING_DATES',
            contextData,
          }),
        );
        return {
          phoneNumber: msg.fromPhone,
          previousState,
          nextState: 'AWAITING_DATES',
          replyText: `⚠️ ${err.message}\n\nEnvie um novo período ou data para prosseguir:`,
        };
      }
      throw err;
    }
  }
}

export const whatsappBotService = new WhatsappBotService();
