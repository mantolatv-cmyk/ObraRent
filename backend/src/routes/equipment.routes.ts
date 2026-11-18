import { Router } from 'express';
import { ValidationError } from '../lib/errors';
import { equipmentService } from '../services/equipment.service';
import type { EquipmentStatus } from '../types/domain';

export const equipmentRouter = Router();

equipmentRouter.get('/categories', async (_req, res) => {
  const categories = await equipmentService.listCategories();
  res.json({ data: categories });
});

equipmentRouter.get('/time-slots', async (req, res) => {
  const rawDate = req.query.date ?? req.query.start_date ?? req.query.startDate;
  const date = typeof rawDate === 'string' ? rawDate.trim() : '';

  if (!date) {
    throw new ValidationError('Informe o parâmetro date (YYYY-MM-DD).', [
      { path: 'date', message: 'date é obrigatório' },
    ]);
  }

  const rawCatIds = req.query.category_ids ?? req.query.category_id ?? req.query.categoryId;
  const rawQuantities = req.query.quantities ?? req.query.quantity;

  const categoryRequests: { categoryId: string; quantity: number }[] = [];
  if (typeof rawCatIds === 'string' && rawCatIds.trim()) {
    const ids = rawCatIds.split(',').map((id) => id.trim()).filter(Boolean);
    const qtys = typeof rawQuantities === 'string'
      ? rawQuantities.split(',').map((q) => Number.parseInt(q.trim(), 10) || 1)
      : [];

    ids.forEach((categoryId, idx) => {
      const quantity = Math.max(1, qtys[idx] ?? 1);
      categoryRequests.push({ categoryId, quantity });
    });
  }

  const timeSlots = await equipmentService.getTimeSlots({
    date,
    categoryRequests: categoryRequests.length > 0 ? categoryRequests : undefined,
  });

  res.json({ data: timeSlots });
});

equipmentRouter.get('/availability', async (req, res) => {
  const startDate = String(req.query.start_date ?? req.query.startDate ?? '').trim();
  const endDate = String(req.query.end_date ?? req.query.endDate ?? '').trim();
  const rawCat = req.query.category_id ?? req.query.categoryId;
  const categoryId = typeof rawCat === 'string' && rawCat.trim() ? rawCat.trim() : undefined;

  if (!startDate || !endDate) {
    throw new ValidationError('Informe start_date e end_date (YYYY-MM-DD).', [
      ...(!startDate ? [{ path: 'start_date', message: 'start_date é obrigatório' }] : []),
      ...(!endDate ? [{ path: 'end_date', message: 'end_date é obrigatório' }] : []),
    ]);
  }

  const availability = await equipmentService.checkAvailability({
    startDate,
    endDate,
    categoryId,
  });

  res.json({ data: availability });
});

equipmentRouter.get('/fleet', async (req, res) => {
  const rawCat = req.query.category_id ?? req.query.categoryId;
  const categoryId = typeof rawCat === 'string' && rawCat.trim() ? rawCat.trim() : undefined;
  const rawStatus = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const status =
    rawStatus && ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED'].includes(rawStatus)
      ? (rawStatus as EquipmentStatus)
      : undefined;

  const fleet = await equipmentService.getFleet({ categoryId, status });
  res.json({ data: fleet });
});

equipmentRouter.patch('/items/:id/status', async (req, res) => {
  const body = (req.body ?? {}) as { status?: unknown };
  const rawStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';
  if (!['AVAILABLE', 'MAINTENANCE', 'RETIRED'].includes(rawStatus)) {
    throw new ValidationError('Status inválido. Use AVAILABLE, MAINTENANCE ou RETIRED.');
  }
  const item = await equipmentService.updateItemStatus(
    req.params.id,
    rawStatus as 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
  );
  res.json({ data: item });
});
