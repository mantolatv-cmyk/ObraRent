import { env } from '../config/env';
import { pool, type Queryable } from '../db/pool';
import { compareIso, isValidIsoDate, rentalDays } from '../lib/dates';
import { InvalidStateTransitionError, NotFoundError, ValidationError } from '../lib/errors';
import { equipmentRepository } from '../repositories/equipment.repository';
import type {
  AvailabilityResult,
  Category,
  EquipmentStatus,
  FleetItem,
  FleetSummary,
  TimeSlotsResult,
} from '../types/domain';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateRentalPeriod(startDate: string, endDate: string): number {
  const issues: { path: string; message: string }[] = [];
  if (!isValidIsoDate(startDate)) {
    issues.push({ path: 'start_date', message: 'Data inicial inválida. Use o formato YYYY-MM-DD.' });
  }
  if (!isValidIsoDate(endDate)) {
    issues.push({ path: 'end_date', message: 'Data final inválida. Use o formato YYYY-MM-DD.' });
  }
  if (issues.length > 0) {
    throw new ValidationError('Período de locação inválido.', issues);
  }
  if (compareIso(endDate, startDate) < 0) {
    throw new ValidationError('A data final deve ser igual ou posterior à data inicial.', [
      { path: 'end_date', message: 'end_date deve ser >= start_date' },
    ]);
  }
  const days = rentalDays(startDate, endDate);
  if (days > env.MAX_RENTAL_DAYS) {
    throw new ValidationError(`O período máximo por contrato é de ${env.MAX_RENTAL_DAYS} dias.`, [
      { path: 'end_date', message: `Máximo de ${env.MAX_RENTAL_DAYS} dias` },
    ]);
  }
  return days;
}

export class EquipmentService {
  async listCategories(db: Queryable = pool): Promise<Category[]> {
    return equipmentRepository.listCategories(db);
  }

  async checkAvailability(
    params: { startDate: string; endDate: string; categoryId?: string },
    db: Queryable = pool,
  ): Promise<AvailabilityResult> {
    const days = validateRentalPeriod(params.startDate, params.endDate);

    if (params.categoryId) {
      if (!UUID_REGEX.test(params.categoryId)) {
        throw new ValidationError('category_id deve ser um UUID válido.', [
          { path: 'category_id', message: 'UUID inválido' },
        ]);
      }
      const category = await equipmentRepository.findCategoryById(db, params.categoryId);
      if (!category) {
        throw new NotFoundError('Categoria de equipamento');
      }
    }

    const categories = await equipmentRepository.getAvailability(db, params);
    return {
      startDate: params.startDate,
      endDate: params.endDate,
      days,
      categories,
    };
  }

  async getFleet(
    params: { categoryId?: string; status?: EquipmentStatus } = {},
    db: Queryable = pool,
  ): Promise<{ items: FleetItem[]; summary: FleetSummary }> {
    return equipmentRepository.listFleet(db, params);
  }

  async getTimeSlots(
    params: {
      date: string;
      categoryRequests?: { categoryId: string; quantity: number }[];
    },
    db: Queryable = pool,
  ): Promise<TimeSlotsResult> {
    if (!isValidIsoDate(params.date)) {
      throw new ValidationError('Data inválida. Use o formato YYYY-MM-DD.', [
        { path: 'date', message: 'Data inválida' },
      ]);
    }
    return equipmentRepository.getTimeSlotsAvailability(db, params);
  }

  async updateItemStatus(
    id: string,
    status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
    db: Queryable = pool,
  ): Promise<FleetItem> {
    if (!UUID_REGEX.test(id)) {
      throw new ValidationError('ID do equipamento inválido.');
    }
    const current = await equipmentRepository.findFleetItemById(db, id);
    if (!current) {
      throw new NotFoundError('Equipamento físico');
    }
    if (current.status === 'RENTED') {
      throw new InvalidStateTransitionError('Equipamento em locação ativa', 'RENTED', status);
    }
    const updated = await equipmentRepository.updateItemStatus(db, id, status);
    if (!updated) {
      throw new NotFoundError('Equipamento físico');
    }
    return updated;
  }
}

export const equipmentService = new EquipmentService();
