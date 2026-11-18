import { onlyDigits } from './cnpj';

/**
 * Normalises Brazilian phone numbers to E.164 digits without "+", e.g.
 * "(11) 99876-5432" -> "5511998765432". Returns null when it cannot be a BR number.
 */
export function normalizeBrPhone(input: string): string | null {
  let d = onlyDigits(input);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith('55') || (d.length !== 12 && d.length !== 13)) return null;
  return d;
}

/** WhatsApp JIDs look like "5511998765432@s.whatsapp.net". */
export function phoneFromJid(jid: string): string {
  return onlyDigits(jid.split('@')[0] ?? '');
}
