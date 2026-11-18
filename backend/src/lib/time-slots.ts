export interface TimeSlotDef {
  slot: string;
  label: string;
  period: 'MANHA' | 'TARDE';
  periodLabel: string;
}

export const STANDARD_TIME_SLOTS: TimeSlotDef[] = [
  { slot: '07:30 - 09:00', label: '07:30 às 09:00', period: 'MANHA', periodLabel: 'Manhã (1ª Viagem)' },
  { slot: '09:00 - 10:30', label: '09:00 às 10:30', period: 'MANHA', periodLabel: 'Manhã (2ª Viagem)' },
  { slot: '10:30 - 12:00', label: '10:30 às 12:00', period: 'MANHA', periodLabel: 'Manhã (3ª Viagem)' },
  { slot: '13:00 - 14:30', label: '13:00 às 14:30', period: 'TARDE', periodLabel: 'Tarde (1ª Viagem)' },
  { slot: '14:30 - 16:00', label: '14:30 às 16:00', period: 'TARDE', periodLabel: 'Tarde (2ª Viagem)' },
  { slot: '16:00 - 17:30', label: '16:00 às 17:30', period: 'TARDE', periodLabel: 'Tarde (3ª Viagem)' },
];

/**
 * Calculates slot capacity proportional to the category's operational units.
 * For example:
 * - 1 to 6 operational units -> 1 unit per slot
 * - 7 to 12 operational units -> 2 units per slot
 * - 60 units (andaimes) -> 10 units per slot
 * - 200 units (escoras) -> 34 units per slot
 */
export function calculateSlotCapacity(operationalUnits: number): number {
  if (operationalUnits <= 0) return 0;
  return Math.max(1, Math.ceil(operationalUnits / STANDARD_TIME_SLOTS.length));
}

export function isValidTimeSlot(slot: string): boolean {
  return STANDARD_TIME_SLOTS.some((s) => s.slot === slot);
}
