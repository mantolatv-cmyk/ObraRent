export interface TimeSlotDef {
  slot: string;
  label: string;
  period: 'MANHA' | 'TARDE';
  periodLabel: string;
}

export const STANDARD_TIME_SLOTS: TimeSlotDef[] = [
  { slot: '07:30', label: '07:30', period: 'MANHA', periodLabel: 'Manhã · 07:30' },
  { slot: '08:00', label: '08:00', period: 'MANHA', periodLabel: 'Manhã · 08:00' },
  { slot: '08:30', label: '08:30', period: 'MANHA', periodLabel: 'Manhã · 08:30' },
  { slot: '09:00', label: '09:00', period: 'MANHA', periodLabel: 'Manhã · 09:00' },
  { slot: '09:30', label: '09:30', period: 'MANHA', periodLabel: 'Manhã · 09:30' },
  { slot: '10:00', label: '10:00', period: 'MANHA', periodLabel: 'Manhã · 10:00' },
  { slot: '10:30', label: '10:30', period: 'MANHA', periodLabel: 'Manhã · 10:30' },
  { slot: '11:00', label: '11:00', period: 'MANHA', periodLabel: 'Manhã · 11:00' },
  { slot: '11:30', label: '11:30', period: 'MANHA', periodLabel: 'Manhã · 11:30' },
  { slot: '12:00', label: '12:00', period: 'TARDE', periodLabel: 'Tarde · 12:00' },
  { slot: '12:30', label: '12:30', period: 'TARDE', periodLabel: 'Tarde · 12:30' },
  { slot: '13:00', label: '13:00', period: 'TARDE', periodLabel: 'Tarde · 13:00' },
  { slot: '13:30', label: '13:30', period: 'TARDE', periodLabel: 'Tarde · 13:30' },
  { slot: '14:00', label: '14:00', period: 'TARDE', periodLabel: 'Tarde · 14:00' },
  { slot: '14:30', label: '14:30', period: 'TARDE', periodLabel: 'Tarde · 14:30' },
  { slot: '15:00', label: '15:00', period: 'TARDE', periodLabel: 'Tarde · 15:00' },
  { slot: '15:30', label: '15:30', period: 'TARDE', periodLabel: 'Tarde · 15:30' },
  { slot: '16:00', label: '16:00', period: 'TARDE', periodLabel: 'Tarde · 16:00' },
  { slot: '16:30', label: '16:30', period: 'TARDE', periodLabel: 'Tarde · 16:30' },
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
  return Math.max(1, Math.ceil(operationalUnits / 6));
}

export function isValidTimeSlot(slot: string): boolean {
  return STANDARD_TIME_SLOTS.some((s) => s.slot === slot);
}
