/**
 * Pix "Copia e Cola" (BR Code) payload builder following the Banco Central
 * EMV-MPM specification. Used by the mock gateway so local development produces
 * payloads that real banking apps can parse.
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

function sanitize(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .toUpperCase()
    .slice(0, max)
    .trim();
}

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
}

export function buildPixPayload(input: PixPayloadInput): string {
  const txid = input.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const merchantAccount =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', input.pixKey) +
    (input.description ? tlv('02', sanitize(input.description, 40)) : '');

  const body =
    tlv('00', '01') +
    tlv('01', '12') + // single-use (dynamic-like) payload
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', input.amount.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', sanitize(input.merchantName, 25)) +
    tlv('60', sanitize(input.merchantCity, 15)) +
    tlv('62', tlv('05', txid)) +
    '6304';

  return body + crc16(body);
}
