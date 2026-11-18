/**
 * Pix "Copia e Cola" (BR Code) payload builder following the Banco Central
 * EMV-MPM specification (Manual de Padrões para Iniciação do Pix).
 * Produces standardized payloads that banking apps (Nubank, Itaú, Bradesco, Inter,
 * Banco do Brasil, Caixa, etc.) scan and parse without errors.
 */

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as required by BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Sanitizes alphanumeric fields according to BACEN BR Code specifications:
 * Removes accents, limits characters to ASCII uppercase [A-Z0-9 .-] and truncates.
 */
export function sanitizePixString(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .toUpperCase()
    .slice(0, max)
    .trim();
}

/**
 * Normalizes a Pix key:
 * - If CNPJ or CPF (with or without formatting): extracts purely digits (14 or 11 chars).
 * - If email: lowercases and trims.
 * - If phone: keeps international format.
 * - If EVP (random key): trims.
 */
export function normalizePixKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 14 || digits.length === 11) {
    return digits;
  }
  return trimmed;
}

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
  postalCode?: string;
  pointOfInitiationMethod?: '11' | '12';
}

export function buildPixPayload(input: PixPayloadInput): string {
  const cleanKey = normalizePixKey(input.pixKey);
  const cleanTxid = input.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let merchantAccount =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', cleanKey);

  if (input.description) {
    merchantAccount += tlv('02', sanitizePixString(input.description, 40));
  }

  // Tag 01 (Point of Initiation Method):
  // BACEN standard for static Pix with Key is '11' (reusable / static).
  // Using '12' without dynamic PSP URL (subtag 25) causes banking apps to reject the code.
  const pointOfInitiation = input.pointOfInitiationMethod ?? '11';

  let body =
    tlv('00', '01') +
    tlv('01', pointOfInitiation) +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', input.amount.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', sanitizePixString(input.merchantName, 25)) +
    tlv('60', sanitizePixString(input.merchantCity, 15));

  if (input.postalCode) {
    const cleanCep = input.postalCode.replace(/\D/g, '').slice(0, 8);
    if (cleanCep.length > 0) {
      body += tlv('61', cleanCep);
    }
  }

  body += tlv('62', tlv('05', cleanTxid)) + '6304';

  return body + crc16(body);
}
