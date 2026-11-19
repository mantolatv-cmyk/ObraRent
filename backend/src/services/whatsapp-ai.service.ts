import { type Queryable } from '../db/pool';
import { onlyDigits } from '../lib/cnpj';
import { addDays, formatBrDate, todayIso } from '../lib/dates';
import { formatBRL, round2 } from '../lib/money';
import { equipmentRepository } from '../repositories/equipment.repository';
import type { DeliveryAddress, WhatsappContextData } from '../types/domain';
import { freightService } from './freight.service';
import { parseWhatsappAddressInput, parseWhatsappDateInput } from './whatsapp-bot.service';

export interface EquipmentKnowledge {
  slug: string;
  name: string;
  popularNames: string[];
  baseDailyRate: number;
  replacementCost: number;
  powerSource: string;
  weight: string;
  application: string;
  differentiator: string;
  specs: string;
}

export const EQUIPMENT_KNOWLEDGE_BASE: EquipmentKnowledge[] = [
  {
    slug: 'compactador-de-solo',
    name: 'Compactador de Solo (Sapo)',
    popularNames: ['compactador', 'sapo', 'pula pula', 'pula-pula', 'compactador a percussao', 'compactadora de percussao', 'wacker'],
    baseDailyRate: 180,
    replacementCost: 14500,
    powerSource: 'Motor 4 Tempos a Gasolina',
    weight: '68 kg a 75 kg',
    application: 'Compactação profunda em valas estreitas, fundações, aterros, assentamento de tubulações e solos argilosos/coesivos.',
    differentiator: 'Aplica golpes verticais de alto impacto (até 14 kN / 1.400 kgf), atingindo camadas profundas onde a placa vibratória não alcança.',
    specs: 'Força de impacto: 14 kN | Golpes/min: 600-700 | Tanque: 2,8L gasolina comum | Sapata de aço 28x33 cm',
  },
  {
    slug: 'placa-vibratoria',
    name: 'Placa Vibratória',
    popularNames: ['placa vibratoria', 'placa', 'placa compactadora', 'vibroacabadora', 'reversivel'],
    baseDailyRate: 150,
    replacementCost: 9800,
    powerSource: 'Motor 4 Tempos a Gasolina',
    weight: '80 kg a 95 kg',
    application: 'Compactação de pisos planos, bloquetes intertravados (pavers), brita graduada, cascalho, base de asfalto e calçamentos.',
    differentiator: 'Vibração contínua de alta frequência superficial. Não danifica bloquetes de concreto (quando usada com manta) e dá acabamento perfeito e plano.',
    specs: 'Frequência de vibração: 5.500 vpm | Força centrífuga: 15 kN | Área de base: 50x45 cm | Velocidade: até 20 m/min',
  },
  {
    slug: 'martelete-rompedor',
    name: 'Martelete Rompedor 10kg',
    popularNames: ['martelete', 'rompedor', 'britadeira', 'marreta eletrica', 'martelo demolidor', 'sds max', 'sds-max'],
    baseDailyRate: 120,
    replacementCost: 6500,
    powerSource: 'Elétrico 220V Monofásico (1.500W a 1.700W)',
    weight: '10 kg a 11 kg',
    application: 'Demolição pesada de lajes de concreto, vigas, sapatas, quebra de pisos, aberturas estruturais e alvenaria espessa.',
    differentiator: 'Potência brutal com sistema antivibração que reduz a fadiga do operador. Encaixe rápido SDS-Max com ponteiro e talhadeira inclusos.',
    specs: 'Impacto: 16 a 25 Joules | Impactos/min: 900-1.890 ipm | Encaixe: SDS-Max | Acompanha ponteiro e talhadeira',
  },
  {
    slug: 'alisadora-de-concreto',
    name: 'Alisadora de Concreto (Bambolê)',
    popularNames: ['alisadora', 'bambole', 'bambolê', 'acabadora de concreto', 'helicoptero', 'helicóptero', 'alisadeira'],
    baseDailyRate: 160,
    replacementCost: 11000,
    powerSource: 'Motor a Gasolina 4T 5.5HP a 6.5HP',
    weight: '75 kg a 85 kg',
    application: 'Acabamento, queima e desempeno perfeito de pisos industriais, lajes de concreto usinado, garagens e galpões.',
    differentiator: 'Diâmetro de 36 polegadas (90 cm) com 4 pás combinadas reguláveis que eliminam ondulações e selam o concreto no ponto de cura.',
    specs: 'Diâmetro do rotor: 36" (910 mm) | Rotação das lâminas: 60 a 125 rpm | Lâminas: 4 lâminas combinadas de alta resistência',
  },
  {
    slug: 'cortadora-de-piso',
    name: 'Cortadora de Piso e Asfalto',
    popularNames: ['cortadora de piso', 'cortadora de asfalto', 'serra clipper', 'clipper', 'serra de piso', 'makitao', 'makitão'],
    baseDailyRate: 190,
    replacementCost: 13500,
    powerSource: 'Motor a Gasolina 4T 13HP',
    weight: '110 kg a 125 kg',
    application: 'Cortes precisos de juntas de dilatação em pisos de concreto, reformas viárias, corte em asfalto e canaletas para tubulações.',
    differentiator: 'Corte refrigerado a água com reservatório integrado e disco diamantado profissional de 14" (profundidade até 12 cm).',
    specs: 'Disco diamantado: 14" (350 mm) | Profundidade máxima de corte: 12 cm | Tanque de água integrado: 30L | Guia frontal retrátil',
  },
  {
    slug: 'andaime-tubular',
    name: 'Andaime Tubular (módulo 1,5m)',
    popularNames: ['andaime', 'andaimes', 'torre de andaime', 'modulo de andaime', 'módulo de andaime'],
    baseDailyRate: 12,
    replacementCost: 650,
    powerSource: 'Manual / Estrutural',
    weight: '22 kg por módulo',
    application: 'Trabalhos em altura com segurança total: fachadas, pinturas, rebocos, instalações elétricas e hidráulicas industriais.',
    differentiator: 'Módulo completo composto por 2 painéis tubulares de 1,5m, travessas diagonais em X e sapatas, conforme normas NR-18.',
    specs: 'Dimensões: 1,50 m x 1,00 m | Tubo de aço carbono galvanizado 42,4 mm (espessura 2,65 mm) | Travas de segurança rápidas',
  },
  {
    slug: 'escora-metalica',
    name: 'Escora Metálica Regulável',
    popularNames: ['escora', 'escoras', 'escora metalica', 'escora metálica', 'pontalete', 'pontaletes', 'escoramento'],
    baseDailyRate: 3.5,
    replacementCost: 180,
    powerSource: 'Manual / Estrutural',
    weight: '11 kg por unidade',
    application: 'Escoramento e sustentação provisória de vigas e lajes maciças durante a concretagem e o período de cura.',
    differentiator: 'Regulagem milimétrica de 2,00m a 3,50m de altura com pino de segurança e rosca de precisão, suportando até 2 toneladas por ponto.',
    specs: 'Altura mínima: 2,00 m | Altura máxima: 3,50 m | Capacidade de carga: 1.200 kg a 2.000 kg dependendo da abertura | Aço galvanizado',
  },
  {
    slug: 'betoneira-400l',
    name: 'Betoneira 400 Litros',
    popularNames: ['betoneira', 'betoneira 400l', 'betoneira 400 litros', 'misturador de concreto', 'menegotti', 'csm'],
    baseDailyRate: 85,
    replacementCost: 5800,
    powerSource: 'Motor Elétrico Monofásico 2CV Bivolt (110V/220V)',
    weight: '155 kg',
    application: 'Preparo homogêneo de concreto, argamassa, reboco e contrapiso em obras residenciais, comerciais e industriais.',
    differentiator: 'Tambor estampado em chapa de aço de alta resistência de 400L com cremalheira em ferro fundido e proteção total do motor (NR-12).',
    specs: 'Capacidade do tambor: 400L | Capacidade de mistura: 310L | Rendimento final: 270L | Rotação: 28 rpm | Motor 2CV',
  },
  {
    slug: 'vibrador-de-concreto',
    name: 'Vibrador de Concreto com Mangote',
    popularNames: ['vibrador de concreto', 'mangote', 'vibrador mangote', 'agulha de concreto', 'adensador de concreto'],
    baseDailyRate: 75,
    replacementCost: 3600,
    powerSource: 'Elétrico Monofásico 220V (2.000W / 2CV)',
    weight: '18 kg (conjunto motor + mangote)',
    application: 'Adensamento de concreto fresco em pilares, vigas, lajes, sapatas e blocos de fundação para eliminar bolhas de ar e bicheiras.',
    differentiator: 'Acompanha mangote pendular de 5 metros com ponteira de aço temperado de 38mm e gaiola tubular protetora.',
    specs: 'Frequência: 12.000 vpm | Diâmetro da agulha: 38 mm | Comprimento do mangote: 5,0 m | Rotação do motor: 3.600 rpm',
  },
  {
    slug: 'martelete-demolidor-30kg',
    name: 'Martelete Demolidor Pesado 30kg',
    popularNames: ['martelete 30kg', 'demolidor 30kg', 'rompedor 30kg', 'britadeira pesada', 'martelo demolidor 30kg'],
    baseDailyRate: 170,
    replacementCost: 11200,
    powerSource: 'Elétrico 220V Monofásico (2.200W)',
    weight: '30 kg',
    application: 'Demolição pesada de pisos industriais de concreto armado, bases de máquinas, rochas, asfalto espesso e fundações.',
    differentiator: 'Energia de impacto extrema de 65 Joules com punhos laterais antivibração e encaixe sextavado 28mm de troca rápida.',
    specs: 'Energia de impacto: 65 Joules | Impactos/min: 1.000 ipm | Encaixe: Sextavado 28 mm | Acompanha ponteiro e talhadeira',
  },
  {
    slug: 'regua-vibratoria',
    name: 'Régua Vibratória para Concreto',
    popularNames: ['regua vibratoria', 'régua vibratória', 'sarrafo vibratorio', 'niveladora de concreto'],
    baseDailyRate: 135,
    replacementCost: 7400,
    powerSource: 'Motor 4 Tempos a Gasolina 1.6HP',
    weight: '22 kg (com perfil de alumínio)',
    application: 'Sarrafeamento, nivelamento e adensamento superficial rápido de pisos de concreto, quadras, galpões e lajes.',
    differentiator: 'Acompanha régua de alumínio extrudado de 3,0 metros leve e indeformável, reduzindo em até 70% o tempo de sarrafeamento.',
    specs: 'Comprimento da régua: 3,00 m | Motor: 4T Gasolina 35cc | Guidão ajustável em altura com amortecedores de vibração',
  },
  {
    slug: 'gerador-de-energia',
    name: 'Gerador de Energia 8 kVA',
    popularNames: ['gerador', 'gerador de energia', 'gerador 8kva', 'grupo gerador'],
    baseDailyRate: 240,
    replacementCost: 16500,
    powerSource: 'Motor a Gasolina 4T 15HP com Partida Elétrica e Manual',
    weight: '88 kg',
    application: 'Fornecimento autônomo de energia elétrica 110V/220V para marteletes, betoneiras, soldas e iluminação em obras sem rede elétrica.',
    differentiator: 'Regulador automático de tensão (AVR) que protege ferramentas eletrônicas, tanque de 25L para até 9h de autonomia contínua.',
    specs: 'Potência máxima: 8,0 kVA (7.500W) | Tensão: Bivolt 115V/230V | Tanque: 25L | Partida elétrica com bateria inclusa',
  },
  {
    slug: 'plataforma-andaime',
    name: 'Piso Metálico para Andaime (1,5 m)',
    popularNames: ['piso metalico', 'piso metálico', 'pranchao de andaime', 'pranchão', 'plataforma de andaime'],
    baseDailyRate: 6,
    replacementCost: 320,
    powerSource: 'Manual / Estrutural',
    weight: '11,5 kg por peça',
    application: 'Forração segura e antiderrapante do piso de trabalho no topo das torres de andaime tubular 1,5m conforme exigência NR-18.',
    differentiator: 'Chapa de aço galvanizado com superfície frisada e perfurada antiderrapante (não acumula água) e ganchos de travamento nas pontas.',
    specs: 'Comprimento: 1,50 m | Largura: 0,33 m (3 pisos cobrem 1,00 m) | Carga admissível: 300 kgf/m² | Norma NR-18',
  },
  {
    slug: 'guincho-de-coluna',
    name: 'Guincho de Coluna Elétrico 400kg',
    popularNames: ['guincho', 'guincho de coluna', 'talha eletrica', 'talha elétrica', 'mini grua'],
    baseDailyRate: 95,
    replacementCost: 4800,
    powerSource: 'Elétrico Monofásico 220V (1.500W)',
    weight: '26 kg',
    application: 'Içamento vertical rápido e seguro de baldes de concreto, sacos de cimento, blocos e ferramentas para andares superiores e lajes.',
    differentiator: 'Capacidade de até 400kg (com polia de inversão) ou 200kg direto, cabo de aço de 30m antirotação e freio eletromagnético automático.',
    specs: 'Capacidade: 200 kg (cabo simples 30m) / 400 kg (cabo duplo 15m) | Velocidade: 10 m/min | Botoeira pendente com parada de emergência',
  },
  {
    slug: 'motobomba-submersivel',
    name: 'Motobomba Submersível 3" (Bomba Mangote)',
    popularNames: ['motobomba', 'bomba submersivel', 'bomba mangote', 'bomba de drenagem', 'bomba dagua', 'bomba de lama'],
    baseDailyRate: 110,
    replacementCost: 5200,
    powerSource: 'Acionamento por Motor a Gasolina 5.5HP ou Elétrico via Mangote Flexível',
    weight: '29 kg',
    application: 'Esgotamento e drenagem rápida de valas inundadas, sapatas, poços, piscinas e águas barrentas com sólidos em suspensão.',
    differentiator: 'Vazão industrial de até 60.000 litros/hora (60 m³/h) com rotor aberto em ferro fundido que bombeia água suja e lama sem entupir.',
    specs: 'Recalque: 3 polegadas (75 mm) | Vazão máxima: 60 m³/h | Altura manométrica máx.: 22 mca | Mangueira de recalque 10m inclusa',
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function findEquipmentByQuery(query: string): EquipmentKnowledge | null {
  const norm = normalize(query);
  for (const item of EQUIPMENT_KNOWLEDGE_BASE) {
    if (normalize(item.name).includes(norm)) return item;
    for (const alias of item.popularNames) {
      if (norm.includes(alias) || alias.includes(norm)) {
        return item;
      }
    }
  }
  return null;
}

export interface ExtractedRentalIntent {
  equipment: EquipmentKnowledge | null;
  quantity: number;
  dates: { startDate: string; endDate: string; days: number } | null;
  address: { address: DeliveryAddress; extractedCnpj: string | null } | null;
  hasAllFields: boolean;
}

export async function extractIntentFromText(
  text: string,
  currentContext?: WhatsappContextData,
): Promise<ExtractedRentalIntent> {
  // 1. Equipment & Quantity
  let equipment = findEquipmentByQuery(text);
  if (!equipment && currentContext?.selectedCategoryName) {
    equipment = findEquipmentByQuery(currentContext.selectedCategoryName);
  }

  let quantity = currentContext?.selectedQuantity ?? 1;
  const qtyMatch = text.match(/(\d{1,2})\s*(?:unidades?|unid?|un|peças?|pecas?|modulos?|módulos?|x|\*)/i) ||
    text.match(/(?:quero|preciso|alugar|locar)\s+(\d{1,2})\s+/i);
  if (qtyMatch && qtyMatch[1]) {
    quantity = Math.max(1, Math.min(50, Number.parseInt(qtyMatch[1], 10)));
  }

  // 2. Dates
  let dates = parseWhatsappDateInput(text);
  if (!dates && currentContext?.startDate && currentContext?.endDate && currentContext?.days) {
    dates = {
      startDate: currentContext.startDate,
      endDate: currentContext.endDate,
      days: currentContext.days,
    };
  }

  // 3. Address
  let address: { address: DeliveryAddress; extractedCnpj: string | null } | null = null;
  const hasCepOrStreet = /\b\d{5}-?\d{3}\b/.test(text) || /\b(?:rua|av|avenida|alameda|estrada|rodovia|bairro|n[º°o]?)\b/i.test(text);
  if (hasCepOrStreet && text.length > 15) {
    address = await parseWhatsappAddressInput(text);
  } else if (currentContext?.deliveryAddress) {
    address = { address: currentContext.deliveryAddress, extractedCnpj: currentContext.cnpj ?? null };
  }

  const hasAllFields = !!(equipment && dates && address);

  return {
    equipment,
    quantity,
    dates,
    address,
    hasAllFields,
  };
}

export class WhatsappAiService {
  /**
   * Responde de forma direta e inteligente a dúvidas de clientes sobre:
   * - Equipamentos, especificações, preços e aplicações técnicas
   * - Diferenças entre equipamentos (ex: sapo vs placa)
   * - Valores de frete e prazos de entrega
   * - Formas de pagamento (Pix instantâneo, Cartão de Crédito e Boleto)
   * - Descontos para períodos longos (7+ dias -10%, 30+ dias -20%)
   * - Estoque e disponibilidade em tempo real
   */
  async answerDirectQuestion(
    query: string,
    _context: WhatsappContextData,
    db: Queryable,
  ): Promise<string | null> {
    const norm = normalize(query);

    // 1. Diferença entre Sapo e Placa Vibratória
    if (
      (norm.includes('diferenca') || norm.includes('qual a diferenca') || norm.includes('comparar') || norm.includes('qual melhor') || norm.includes('quando usar')) &&
      (norm.includes('sapo') || norm.includes('compactador')) &&
      (norm.includes('placa') || norm.includes('vibratoria'))
    ) {
      return [
        `🔨 *Diferença Técnica: Compactador de Solo (Sapo) vs Placa Vibratória*`,
        ``,
        `• *Compactador de Solo (Sapo) — R$ 180/dia:*`,
        `Funciona por *golpes verticais de alto impacto* (percussão profunda até 14 kN). É o equipamento ideal para *valas estreitas, aterros, fundações e solos argilosos/fofos* que precisam de adensamento em profundidade.`,
        ``,
        `• *Placa Vibratória — R$ 150/dia:*`,
        `Funciona por *vibração contínua superficial* em alta frequência. É ideal para *superfícies planas, assentamento de bloquetes/pavers (não quebra o concreto), brita graduada, cascalho e base de asfalto*.`,
        ``,
        `💡 *Resumo:* Terra fofa ou vala profunda = *Sapo*. Bloquetes, brita e nivelamento plano = *Placa Vibratória*.`,
        ``,
        `Deseja alugar algum deles agora? Informe qual deles e por quantos dias você precisa!`,
      ].join('\n');
    }

    // 2. Preço / Diária de Equipamento Específico
    const isPriceQuestion =
      norm.includes('quanto custa') ||
      norm.includes('qual o valor') ||
      norm.includes('qual o preco') ||
      norm.includes('qual a diaria') ||
      norm.includes('tabela de preco') ||
      norm.includes('preco') ||
      norm.includes('diaria');

    const matchedEquip = findEquipmentByQuery(query);
    if (isPriceQuestion && matchedEquip) {
      return [
        `💰 *Valores de Locação: ${matchedEquip.name}*`,
        ``,
        `• *Diária avulsa:* ${formatBRL(matchedEquip.baseDailyRate)}/dia`,
        `• *Semanal (7+ dias):* ${formatBRL(round2(matchedEquip.baseDailyRate * 0.9))}/dia (*10% de desconto automático!*)`,
        `• *Mensal (30+ dias):* ${formatBRL(round2(matchedEquip.baseDailyRate * 0.8))}/dia (*20% de desconto mensal!*)`,
        ``,
        `⚙️ *Especificação rápida:* ${matchedEquip.specs}`,
        `📦 *Aplicação ideal:* ${matchedEquip.application}`,
        ``,
        `Gostaria de reservar? Envie a quantidade e as datas desejadas (ex.: *Quero 1 para amanhã por 5 dias*).`,
      ].join('\n');
    }

    // 3. Recomendação para Quebra / Demolição
    if (
      norm.includes('quebrar concreto') ||
      norm.includes('demolir') ||
      norm.includes('demolicao') ||
      norm.includes('quebrar laje') ||
      norm.includes('quebrar piso') ||
      norm.includes('furar concreto')
    ) {
      const rompedor = EQUIPMENT_KNOWLEDGE_BASE.find((e) => e.slug === 'martelete-rompedor')!;
      return [
        `💥 *Recomendação para Demolição de Concreto:*`,
        ``,
        `Para quebrar pisos, vigas, sapatas ou lajes, recomendamos o nosso *${rompedor.name}* (${formatBRL(rompedor.baseDailyRate)}/dia).`,
        `• Encaixe profissional SDS-Max (acompanha ponteiro e talhadeira).`,
        `• Força de impacto de até 25 Joules — peso perfeito (10kg) para equilíbrio entre potência e manuseio.`,
        `• Ligação elétrica 220V padrão de obra.`,
        ``,
        `Temos unidades disponíveis para envio imediato! Por quantos dias você precisa?`,
      ].join('\n');
    }

    // 4. Recomendação para Alisar / Queimar Concreto
    if (
      norm.includes('alisar concreto') ||
      norm.includes('queimar concreto') ||
      norm.includes('desempenar piso') ||
      norm.includes('bambole') ||
      norm.includes('helicoptero de piso')
    ) {
      const alisadora = EQUIPMENT_KNOWLEDGE_BASE.find((e) => e.slug === 'alisadora-de-concreto')!;
      return [
        `✨ *Recomendação para Acabamento de Pisos e Lajes:*`,
        ``,
        `O equipamento ideal é a nossa *${alisadora.name}* (${formatBRL(alisadora.baseDailyRate)}/dia).`,
        `• Diâmetro de 36" (90 cm) com 4 pás combinadas reguláveis.`,
        `• Motor a gasolina 4 tempos de 6.5 HP.`,
        `• Proporciona acabamento espelhado, sela a superfície e elimina juntas e imperfeições.`,
        ``,
        `Quantas unidades você precisa para a sua concretagem?`,
      ].join('\n');
    }

    // 5. Perguntas sobre Frete & Prazos de Entrega
    if (
      norm.includes('frete') ||
      norm.includes('onde entregam') ||
      norm.includes('entrega') ||
      norm.includes('horario de entrega') ||
      norm.includes('como funciona o frete')
    ) {
      // Se houver um CEP na pergunta, já informa na hora!
      const cepMatch = query.match(/\b\d{5}-?\d{3}\b/);
      let freteInfo = '';
      if (cepMatch) {
        const est = freightService.calculate({ cep: onlyDigits(cepMatch[0]) }, 1);
        freteInfo = `\n📍 *CEP ${cepMatch[0]}:* Zona ${est.zone} — *Frete Grátis / Incluso* (R$ 0,00) com entrega e recolhimento no canteiro.\n`;
      }

      return [
        `🚚 *Logística & Frete na Mantovani:*`,
        freteInfo,
        `• *Frete Incluso / Sem Custo Adicional:* O frete foi eliminado da conta! Você paga estritamente o valor das diárias dos equipamentos.`,
        `• *Entrega e Retirada:* Levamos as máquinas até o local da obra e fazemos o recolhimento ao término do contrato.`,
        `• *Horários de Entrega:* As frotas saem a partir das 07h00 para disponibilizar os equipamentos antes do início do expediente de trabalho.`,
        ``,
        `Informe o CEP do seu canteiro e os equipamentos desejados para gerarmos seu pedido!`,
      ].join('\n');
    }

    // 6. Perguntas sobre Formas de Pagamento
    if (
      norm.includes('forma de pagamento') ||
      norm.includes('formas de pagamento') ||
      norm.includes('pagamento') ||
      norm.includes('aceita boleto') ||
      norm.includes('parcelar') ||
      norm.includes('pix') ||
      norm.includes('cartao')
    ) {
      return [
        `💳 *Formas de Pagamento Aceitas:*`,
        ``,
        `1. ⚡ *Pix Copia e Cola / QR Code:*`,
        `Aprovação instantânea 24/7! O sistema aloca e separa os patrimônios na mesma hora para despacho rápido.`,
        ``,
        `2. 💳 *Cartão de Crédito:*`,
        `Processado via link seguro com confirmação rápida.`,
        ``,
        `3. 📄 *Boleto Bancário:*`,
        `Disponível para emissão e liquidação bancária.`,
        ``,
        `Qualquer dúvida, pode nos chamar ou escolher o equipamento para simular a locação!`,
      ].join('\n');
    }

    // 7. Descontos e Locação por Período
    if (
      norm.includes('desconto') ||
      norm.includes('locacao mensal') ||
      norm.includes('mensal') ||
      norm.includes('semanal') ||
      norm.includes('tem desconto')
    ) {
      return [
        `🏷️ *Tabela de Descontos Automáticos por Duração:*`,
        ``,
        `• *Diária Padrão (1 a 6 dias):* Valor de tabela cheia.`,
        `• *A partir de 7 dias:* 💥 *10% de desconto* aplicado em todas as diárias!`,
        `• *A partir de 30 dias (Mensal):* 🚀 *20% de desconto* aplicado em todas as diárias!`,
        ``,
        `O desconto é calculado automaticamente no fechamento do pedido. Qual equipamento e quantos dias você pretende alugar?`,
      ].join('\n');
    }

    // 8. Consulta de Estoque / Disponibilidade Geral em Tempo Real
    if (
      norm.includes('tem disponivel') ||
      norm.includes('esta disponivel') ||
      norm.includes('tem estoque') ||
      norm.includes('tem para amanha') ||
      norm.includes('disponibilidade')
    ) {
      const today = todayIso();
      const nextWeek = addDays(today, 3);
      const avail = await equipmentRepository.getAvailability(db, {
        startDate: today,
        endDate: nextWeek,
        categoryId: matchedEquip ? (await equipmentRepository.listCategories(db)).find((c) => c.slug === matchedEquip.slug)?.id : undefined,
      });

      const lines = avail.map((a) => {
        const icon = a.availableCount > 0 ? '🟢' : '🔴';
        return `${icon} *${a.categoryName}:* ${a.availableCount} unidade(s) pronta(s) para entrega (${formatBRL(a.dailyRate)}/dia)`;
      });

      return [
        `📦 *Disponibilidade em Tempo Real no Pátio (Hoje até ${formatBrDate(nextWeek)}):*`,
        ``,
        lines.join('\n'),
        ``,
        `Todos os itens passam por revisão mecânica e limpeza antes do envio. Deseja reservar alguma unidade?`,
      ].join('\n');
    }

    // 9. Documentos e Requisitos para Locação
    if (
      norm.includes('o que precisa para alugar') ||
      norm.includes('documentos') ||
      norm.includes('precisa de cnpj') ||
      norm.includes('pessoa fisica') ||
      norm.includes('caucao')
    ) {
      return [
        `📋 *Como Funciona a Locação na Mantovani:*`,
        ``,
        `• *Atendimento para Pessoa Física e Empresas:* Atendemos reformas e construções residenciais (CPF) ou grandes obras e construtoras (CNPJ).`,
        `• *Sem burocracia:* Contrato formal gerado digitalmente em PDF com termos de vistoria, relação de patrimônio e seguro de reposição.`,
        `• *Aprovação Expressa:* Digite o equipamento que precisa e receba o orçamento com Pix na hora!`,
        `• *Entrega Direta no Local:* Levamos as ferramentas direto até o endereço da sua obra ou reforma.`,
        ``,
        `Posso te ajudar a montar seu pedido agora?`,
      ].join('\n');
    }

    // 10. Catálogo Completo Solicitado Direto
    if (
      norm.includes('quais maquinas') ||
      norm.includes('quais equipamentos') ||
      norm.includes('catalogo') ||
      norm.includes('o que voces tem') ||
      norm.includes('lista de ferramentas')
    ) {
      const categories = await equipmentRepository.listCategories(db);
      const list = categories.map((c) => `• *${c.name}* — ${formatBRL(c.baseDailyRate)}/dia (${c.operationalUnits} un. na frota)\n  _${c.description}_`);
      return [
        `🏗️ *Frota Oficial Mantovani — Equipamentos para Construção:*`,
        ``,
        list.join('\n\n'),
        ``,
        `💡 *Para alugar, basta me dizer o nome da máquina e quantos dias você precisa!* (Exemplo: *"Quero o martelete por 5 dias"*).`,
      ].join('\n');
    }

    return null;
  }
}

export const whatsappAiService = new WhatsappAiService();
