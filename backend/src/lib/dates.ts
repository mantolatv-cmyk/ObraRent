/**
 * Calendar-date helpers. Rental periods are civil dates (no time component)
 * in the business timezone; we represent them as ISO `YYYY-MM-DD` strings and do
 * arithmetic in UTC to avoid DST surprises.
 */
export const BUSINESS_TZ = 'America/Sao_Paulo';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's civil date in the business timezone. */
export function todayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Number of billable days, inclusive of both ends (20 → 22 = 3 days). */
export function rentalDays(startIso: string, endIso: string): number {
  return Math.round((toUtc(endIso) - toUtc(startIso)) / DAY_MS) + 1;
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Builds an ISO date from day/month(/year) parts, inferring the year when omitted. */
export function buildIsoDate(day: number, month: number, year: number | undefined, reference: string): string | null {
  const refYear = Number(reference.slice(0, 4));
  let y = year ?? refYear;
  if (y < 100) y += 2000;
  const pad = (n: number) => String(n).padStart(2, '0');
  let iso = `${y}-${pad(month)}-${pad(day)}`;
  if (!isValidIsoDate(iso)) return null;
  // "05/01" typed in December means next January.
  if (year === undefined && compareIso(iso, reference) < 0) {
    iso = `${y + 1}-${pad(month)}-${pad(day)}`;
    if (!isValidIsoDate(iso)) return null;
  }
  return iso;
}
