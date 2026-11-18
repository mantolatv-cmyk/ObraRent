import { formatBRL, formatDateLong, maskCep, maskCpfOrCnpj, PAYMENT_METHOD_LABEL } from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

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

export function warehouseOrderWhatsappLink(rental: RentalSummary, customPhone?: string): string {
  if (!customPhone && rental.warehouseWhatsappUrl) {
    return rental.warehouseWhatsappUrl;
  }
  const phone = customPhone ? onlyDigitsSafe(customPhone) : WHATSAPP_NUMBER;
  const addr = rental.deliveryAddress;
  const methodLabel = rental.payment ? PAYMENT_METHOD_LABEL[rental.payment.method] : 'A definir';
  const itemsList = rental.items
    .map((i) => `• 1x *${i.categoryName}* — Patrimônio: *${i.assetTag}* (${formatBRL(i.agreedDailyRate)}/dia)`)
    .join('\n');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const contractUrl = origin ? `${origin}/pedidos/${rental.id}/contrato` : `/pedidos/${rental.id}/contrato`;

  const message = [
    `🏭 *ORDEM DE SEPARAÇÃO DE ESTOQUE — MANTOVANI*`,
    `📄 *Contrato Ativo:* *${rental.code}*`,
    `📌 *Status:* LOCAÇÃO ATIVA — SEPARAR EQUIPAMENTO IMEDIATAMENTE`,
    ``,
    `👤 *CLIENTE / LOCATÁRIO:*`,
    `• *Nome/Empresa:* ${rental.client.companyName}`,
    `• *CPF/CNPJ:* ${maskCpfOrCnpj(rental.client.cnpj)}`,
    ``,
    `🚜 *EQUIPAMENTOS PARA SEPARAR NO ESTOQUE (${rental.items.length} un.):*`,
    itemsList,
    ``,
    `📅 *PERÍODO & JANELA DE ENTREGA:*`,
    `• *Vigência:* ${formatDateLong(rental.startDate)} a ${formatDateLong(rental.endDate)} (${rental.days} diária(s))`,
    ...(rental.deliveryTimeSlot ? [`• *Horário Agendado:* *${rental.deliveryTimeSlot}*`] : []),
    ``,
    `📍 *ENDEREÇO DE ENTREGA NA OBRA:*`,
    `• ${addr.street}, ${addr.number}${addr.complement ? ` (${addr.complement})` : ''}`,
    `• ${addr.district} — ${addr.city}/${addr.state} — CEP ${maskCep(addr.cep)}`,
    ...(addr.reference ? [`• *Referência:* ${addr.reference}`] : []),
    ``,
    `💰 *FINANCEIRO:*`,
    `• *Forma de Pagamento:* ${methodLabel}`,
    ...(rental.subtotal > rental.totalAmount
      ? [`• *Desconto Dinheiro (8%):* -${formatBRL(rental.subtotal - rental.totalAmount)}`]
      : []),
    `• *Valor Total:* *${formatBRL(rental.totalAmount)}*`,
    ``,
    `🔗 *Contrato & Romaneio:* ${contractUrl}`,
  ].join('\n');

  return `https://wa.me/${phone || WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
