export const WHATSAPP_NUMBER = onlyDigitsSafe(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511999999999');

function onlyDigitsSafe(v: string): string {
  return v.replace(/\D+/g, '');
}

export function whatsappLink(text = 'alugar'): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const IS_DEV = process.env.NODE_ENV !== 'production';

export const SHOW_DEV_SIMULATOR =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_SIMULATOR !== 'false';

export const APP_NAME = 'Mantovani';
