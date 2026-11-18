import { onlyDigits } from '@/lib/format';

/** Validates a CNPJ using the official mod-11 check digit algorithm. */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string, weights: number[]): number => {
    const sum = base.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d2 === Number(cnpj[13]);
}

/** Validates a CPF (Receita Federal algorithm). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (digits[i] ?? 0) * (10 - i);
  let rest = 11 - (sum % 11);
  if (rest >= 10) rest = 0;
  if (rest !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += (digits[i] ?? 0) * (11 - i);
  rest = 11 - (sum % 11);
  if (rest >= 10) rest = 0;
  return rest === digits[10];
}

/** Validates either a CPF (11 digits) or CNPJ (14 digits). */
export function isValidCpfOrCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value)) && !/^0{8}$/.test(onlyDigits(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Brazilian phone: DDD + 8 digits (landline) or DDD + 9 + 8 digits (mobile). */
export function isValidPhoneBR(value: string): boolean {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return false;
  if (!VALID_DDD.has(Number(d.slice(0, 2)))) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

/** Brazilian mobile (WhatsApp). */
export function isValidMobileBR(value: string): boolean {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.length === 11 && isValidPhoneBR(d);
}

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ',
  'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export function isValidUF(value: string): boolean {
  return (UF_LIST as readonly string[]).includes(value.toUpperCase());
}
