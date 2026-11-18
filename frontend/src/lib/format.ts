export const onlyDigits = (v: string): string => v.replace(/\D+/g, '');

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 1234.5 → "R$ 1.234,50" */
export function formatBRL(value: number): string {
  return brl.format(Number.isFinite(value) ? value : 0).replace(/\u00a0/g, ' ');
}

/** 150 → "R$ 150"; 149.9 → "R$ 149,9" (for compact price tags) */
export function formatBRLCompact(value: number): string {
  return brlCompact.format(Number.isFinite(value) ? value : 0).replace(/\u00a0/g, ' ');
}

// ---------- Dates (ISO calendar dates "YYYY-MM-DD", handled in local time) ----------

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Inclusive day count: 2024-05-20 → 2024-05-22 = 3 */
export function inclusiveDays(start: string, end: string): number {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (!a || !b) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return diff >= 0 ? diff + 1 : 0;
}

const dateShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const dateLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2024-05-20" → "20 de mai." */
export function formatDateShort(iso: string): string {
  const d = parseISODate(iso);
  return d ? dateShort.format(d) : iso;
}

/** "2024-05-20" → "seg., 20 de mai. de 2024" */
export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return d ? dateLong.format(d) : iso;
}

/** ISO datetime → "20/05/2024, 14:32" */
export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return Number.isNaN(d.getTime()) ? isoDateTime : dateTime.format(d);
}

export function formatPeriod(start: string, end: string): string {
  const days = inclusiveDays(start, end);
  return `${formatDateShort(start)} → ${formatDateShort(end)} · ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ---------- Masks ----------

/** "12345678000195" → "12.345.678/0001-95" (progressive) */
export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Masks CPF (11 digits) or CNPJ (14 digits) progressively */
export function maskCpfOrCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return maskCnpj(d);
}

export const formatCpfOrCnpj = maskCpfOrCnpj;

/** "01310100" → "01310-100" (progressive) */
export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** "11987654321" → "(11) 98765-4321"; landline "1133334444" → "(11) 3333-4444" */
export function maskPhone(v: string): string {
  let d = onlyDigits(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length === 11) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const FREIGHT_ZONE_LABEL: Record<'URBAN' | 'METRO' | 'REGIONAL' | 'EXTENDED', string> = {
  URBAN: 'Zona urbana',
  METRO: 'Região metropolitana',
  REGIONAL: 'Regional',
  EXTENDED: 'Área estendida',
};

export const PAYMENT_METHOD_LABEL: Record<'PIX' | 'CREDIT_CARD' | 'BOLETO', string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  BOLETO: 'Boleto',
};
