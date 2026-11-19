import express from 'express';
const { Router } = express;
import { z } from 'zod';
import { onlyDigits } from '../lib/cnpj';
import { ValidationError } from '../lib/errors';
import { rentalService } from '../services/rental.service';
import type { DeliveryAddress, PaymentMethod, RentalChannel, RentalStatus } from '../types/domain';

export const rentalsRouter = Router();

const UuidSchema = z.string().uuid('UUID de categoria inválido');

function parseItemsArray(rawItems: unknown): { categoryId: string; quantity: number }[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ValidationError('Informe ao menos um item para locação.', [
      { path: 'items', message: 'Lista de itens não pode ser vazia' },
    ]);
  }
  return rawItems.map((item, idx) => {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError(`Item #${idx + 1} inválido.`, [{ path: `items.${idx}`, message: 'Objeto inválido' }]);
    }
    const obj = item as Record<string, unknown>;
    const categoryId = String(obj.categoryId ?? obj.category_id ?? '').trim();
    const quantity = Number(obj.quantity);
    const parsedCat = UuidSchema.safeParse(categoryId);
    if (!parsedCat.success) {
      throw new ValidationError('category_id deve ser um UUID válido.', [
        { path: `items.${idx}.categoryId`, message: 'UUID inválido' },
      ]);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new ValidationError('Quantidade deve ser um inteiro entre 1 e 500.', [
        { path: `items.${idx}.quantity`, message: 'Quantidade inválida' },
      ]);
    }
    return { categoryId, quantity };
  });
}

function parseDeliveryAddress(raw: unknown): DeliveryAddress {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Endereço de entrega obrigatório.', [
      { path: 'deliveryAddress', message: 'Informe o endereço da obra' },
    ]);
  }
  const addr = raw as Record<string, unknown>;
  const cep = onlyDigits(String(addr.cep ?? addr.zipCode ?? addr.postal_code ?? ''));
  const street = String(addr.street ?? addr.logradouro ?? '').trim();
  const number = String(addr.number ?? addr.numero ?? 'S/N').trim();
  const complement = typeof addr.complement === 'string' && addr.complement.trim() ? addr.complement.trim() : undefined;
  const district = String(addr.district ?? addr.bairro ?? 'Centro').trim();
  const city = String(addr.city ?? addr.cidade ?? '').trim();
  const state = String(addr.state ?? addr.uf ?? 'SP').trim().toUpperCase();
  const reference = typeof addr.reference === 'string' && addr.reference.trim() ? addr.reference.trim() : undefined;
  const latitude = typeof addr.latitude === 'number' ? addr.latitude : undefined;
  const longitude = typeof addr.longitude === 'number' ? addr.longitude : undefined;

  const issues: { path: string; message: string }[] = [];
  if (cep.length !== 8) {
    issues.push({ path: 'deliveryAddress.cep', message: 'CEP deve ter 8 dígitos.' });
  }
  if (street.length < 2) {
    issues.push({ path: 'deliveryAddress.street', message: 'Informe o logradouro.' });
  }
  if (city.length < 2) {
    issues.push({ path: 'deliveryAddress.city', message: 'Informe a cidade.' });
  }
  if (state.length !== 2) {
    issues.push({ path: 'deliveryAddress.state', message: 'Informe a UF com 2 letras.' });
  }
  if (issues.length > 0) {
    throw new ValidationError(issues[0]!.message, issues);
  }

  return {
    cep,
    street,
    number: number || 'S/N',
    complement,
    district: district || 'Centro',
    city,
    state,
    reference,
    latitude,
    longitude,
  };
}

rentalsRouter.get('/', async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const status =
    rawStatus && ['PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(rawStatus)
      ? (rawStatus as RentalStatus)
      : undefined;
  const cnpj = typeof req.query.cnpj === 'string' && req.query.cnpj.trim() ? req.query.cnpj.trim() : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const result = await rentalService.listRentals({ status, cnpj, limit });
  res.json({ data: result });
});

rentalsRouter.post('/quote', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const startDate = String(body.startDate ?? body.start_date ?? '').trim();
  const endDate = String(body.endDate ?? body.end_date ?? '').trim();
  const items = parseItemsArray(body.items);

  const rawAddr = (body.deliveryAddress ?? body.delivery_address) as Record<string, unknown> | undefined;
  const partialAddress: Partial<DeliveryAddress> | undefined = rawAddr
    ? {
      cep: typeof rawAddr.cep === 'string' ? onlyDigits(rawAddr.cep) : undefined,
      state: typeof rawAddr.state === 'string' ? rawAddr.state : undefined,
      latitude: typeof rawAddr.latitude === 'number' ? rawAddr.latitude : undefined,
      longitude: typeof rawAddr.longitude === 'number' ? rawAddr.longitude : undefined,
    }
    : undefined;

  const rawQuoteMethod = String(body.paymentMethod ?? body.payment_method ?? '').toUpperCase();
  const quotePaymentMethod: PaymentMethod | undefined =
    rawQuoteMethod === 'CASH' || rawQuoteMethod === 'DINHEIRO'
      ? 'CASH'
      : rawQuoteMethod === 'PIX' || rawQuoteMethod === 'CREDIT_CARD' || rawQuoteMethod === 'BOLETO'
        ? (rawQuoteMethod as PaymentMethod)
        : undefined;

  const quote = await rentalService.quote({
    startDate,
    endDate,
    items,
    deliveryAddress: partialAddress,
    paymentMethod: quotePaymentMethod,
  });

  res.json({ data: quote });
});

rentalsRouter.post('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const startDate = String(body.startDate ?? body.start_date ?? '').trim();
  const endDate = String(body.endDate ?? body.end_date ?? '').trim();
  const items = parseItemsArray(body.items);
  const deliveryAddress = parseDeliveryAddress(body.deliveryAddress ?? body.delivery_address);

  const rawClient = (typeof body.client === 'object' && body.client !== null ? body.client : {}) as Record<
    string,
    unknown
  >;
  const cnpj = String(rawClient.cnpj ?? body.cnpj ?? body.client_cnpj ?? '').trim();
  const companyName = String(rawClient.companyName ?? rawClient.company_name ?? body.companyName ?? body.company_name ?? '').trim() || undefined;
  const tradeName = String(rawClient.tradeName ?? rawClient.trade_name ?? body.tradeName ?? body.trade_name ?? '').trim() || undefined;
  const email = String(rawClient.email ?? body.email ?? '').trim() || undefined;
  const phone = String(rawClient.phone ?? body.phone ?? '').trim() || undefined;

  const rawMethodInput = String(body.paymentMethod ?? body.payment_method ?? 'PIX').toUpperCase();
  const rawMethod = rawMethodInput === 'DINHEIRO' ? 'CASH' : rawMethodInput;
  if (!['PIX', 'CASH', 'CREDIT_CARD', 'BOLETO'].includes(rawMethod)) {
    throw new ValidationError('Método de pagamento inválido. Use PIX, CASH, CREDIT_CARD ou BOLETO.', [
      { path: 'paymentMethod', message: 'Método inválido' },
    ]);
  }
  const paymentMethod = rawMethod as PaymentMethod;

  const rawChannel = String(body.channel ?? 'WEB').toUpperCase();
  const channel: RentalChannel = rawChannel === 'WHATSAPP' ? 'WHATSAPP' : 'WEB';

  const rawTimeSlot = body.deliveryTimeSlot ?? body.delivery_time_slot;
  const deliveryTimeSlot = typeof rawTimeSlot === 'string' && rawTimeSlot.trim() ? rawTimeSlot.trim() : undefined;

  const summary = await rentalService.createRental({
    client: { cnpj, companyName, tradeName, email, phone },
    startDate,
    endDate,
    items,
    deliveryAddress,
    paymentMethod,
    channel,
    contactPhone: phone,
    deliveryTimeSlot,
  });

  res.status(201).json({ data: summary });
});

rentalsRouter.get('/:id', async (req, res) => {
  const summary = await rentalService.getRentalById(req.params.id);
  res.json({ data: summary });
});

rentalsRouter.post('/:id/simulate-payment', async (req, res) => {
  const summary = await rentalService.simulatePaymentApproval(req.params.id);
  res.json({ data: summary });
});

rentalsRouter.post('/:id/activate', async (req, res) => {
  const body = (req.body ?? {}) as { companyPhone?: unknown };
  const companyPhone = typeof body.companyPhone === 'string' && body.companyPhone.trim() ? body.companyPhone.trim() : undefined;
  const summary = await rentalService.activateAndNotifyWarehouse(req.params.id, companyPhone);
  res.json({ data: summary });
});

rentalsRouter.get('/:id/contract', async (req, res) => {
  const doc = await rentalService.getContractDocument(req.params.id);
  res.json({ data: doc });
});

rentalsRouter.post('/:id/cancel', async (req, res) => {
  const summary = await rentalService.cancelRental(req.params.id);
  res.json({ data: summary });
});

rentalsRouter.post('/:id/dispatch', async (req, res) => {
  const summary = await rentalService.dispatchRental(req.params.id);
  res.json({ data: summary });
});

rentalsRouter.post('/:id/return', async (req, res) => {
  const body = (req.body ?? {}) as { maintenanceAssetTags?: unknown };
  const maintenanceAssetTags = Array.isArray(body.maintenanceAssetTags)
    ? body.maintenanceAssetTags.filter((t): t is string => typeof t === 'string')
    : [];
  const summary = await rentalService.returnRental(req.params.id, maintenanceAssetTags);
  res.json({ data: summary });
});

rentalsRouter.post('/:id/extend', async (req, res) => {
  const body = (req.body ?? {}) as { additionalDays?: unknown; days?: unknown };
  const additionalDays = Number(body.additionalDays ?? body.days ?? 0);
  const summary = await rentalService.extendRental(req.params.id, additionalDays);
  res.json({ data: summary });
});
