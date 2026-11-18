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

export const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '52342052000140';
export const PIX_KEY_FORMATTED = '52.342.052/0001-40';
export const PIX_BENEFICIARY = 'Máquinas para Concreto Atibaiense Ltda';
export const PIX_CITY = 'Atibaia - SP';

export function pixProofWhatsappLink(rentalCode: string, amountFormatted: string, company?: string): string {
  const intro = company ? ` referente à empresa *${company}*` : '';
  const message = [
    `Olá Mantovani! Acabei de realizar o pagamento Pix do pedido *${rentalCode}* no valor de *${amountFormatted}*${intro}.`,
    ``,
    `Segue o comprovante em anexo para conferência e liberação imediata da locação! 🚜`,
  ].join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
