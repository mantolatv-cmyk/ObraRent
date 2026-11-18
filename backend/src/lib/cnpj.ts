/** Document helpers (CPF & CNPJ Receita Federal check-digit algorithms). */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCnpj(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split('').map(Number);
  const calc = (length: number): number => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * (digits[i] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calc(12) === digits[12] && calc(13) === digits[13];
}

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
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

export function isValidCpfOrCnpj(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

export function normalizeCnpj(input: string): string {
  return onlyDigits(input);
}

export function formatCnpj(input: string): string {
  const d = onlyDigits(input).padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCpf(input: string): string {
  const d = onlyDigits(input).padStart(11, '0');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCpfOrCnpj(input: string): string {
  const d = onlyDigits(input);
  if (d.length <= 11) return formatCpf(d);
  return formatCnpj(d);
}
