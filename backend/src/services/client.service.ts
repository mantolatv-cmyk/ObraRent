import { pool, type Queryable } from '../db/pool';
import { createAuthToken, hashPassword, verifyPassword } from '../lib/auth';
import { formatCpfOrCnpj, isValidCpfOrCnpj, normalizeCnpj, onlyDigits } from '../lib/cnpj';
import { InvalidCnpjError, NotFoundError, UnauthorizedError, ValidationError } from '../lib/errors';
import { normalizeBrPhone } from '../lib/phone';
import { clientRepository } from '../repositories/client.repository';
import type { Client } from '../types/domain';

export interface CnpjLookupResult {
  cnpj: string;
  registered: boolean;
  companyName: string | null;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
}

export interface ClientOnboardingInput {
  cnpj: string;
  companyName?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
}

export interface RegisterInput {
  cnpj: string;
  companyName: string;
  tradeName?: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthResult {
  client: Client;
  token: string;
}

export class ClientService {
  /**
   * Consulta apenas localmente se o cliente (PF ou PJ) já possui cadastro prévio na plataforma.
   */
  async lookupCnpj(rawCnpj: string, db: Queryable = pool): Promise<CnpjLookupResult> {
    const cnpj = normalizeCnpj(rawCnpj);
    if (!isValidCpfOrCnpj(cnpj)) {
      throw new InvalidCnpjError('Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
    }

    const existing = await clientRepository.findByCnpj(db, cnpj);
    if (existing) {
      return {
        cnpj,
        registered: true,
        companyName: existing.companyName,
        tradeName: existing.tradeName,
        email: existing.email,
        phone: existing.phone,
      };
    }

    return {
      cnpj,
      registered: false,
      companyName: null,
      tradeName: null,
      email: null,
      phone: null,
    };
  }

  /**
   * Registra ou atualiza os dados cadastrais do cliente (Pessoa Física ou Jurídica).
   */
  async ensureClient(input: ClientOnboardingInput, db: Queryable = pool): Promise<Client> {
    const cnpj = normalizeCnpj(input.cnpj);
    if (!isValidCpfOrCnpj(cnpj)) {
      throw new InvalidCnpjError('Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
    }

    const existing = await clientRepository.findByCnpj(db, cnpj);
    const defaultName = cnpj.length <= 11 ? `Cliente ${formatCpfOrCnpj(cnpj)}` : `Empresa ${formatCpfOrCnpj(cnpj)}`;
    const companyName = input.companyName?.trim() || existing?.companyName || defaultName;
    const tradeName = input.tradeName?.trim() || existing?.tradeName || null;
    const email = input.email?.trim().toLowerCase() || existing?.email || null;
    const phone = input.phone ? normalizeBrPhone(input.phone) : existing?.phone ?? null;

    return clientRepository.upsertByCnpj(db, {
      cnpj,
      companyName,
      tradeName,
      email,
      phone,
    });
  }

  /**
   * Cadastro completo com senha para novos clientes ou ativação de conta.
   */
  async register(input: RegisterInput, db: Queryable = pool): Promise<AuthResult> {
    const cleanDoc = normalizeCnpj(input.cnpj);
    if (!isValidCpfOrCnpj(cleanDoc)) {
      throw new InvalidCnpjError('Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
    }

    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new ValidationError('Informe um endereço de e-mail válido.');
    }

    if (!input.companyName || input.companyName.trim().length === 0) {
      throw new ValidationError('Informe seu nome completo ou razão social.');
    }

    if (!input.password || input.password.length < 6) {
      throw new ValidationError('A senha deve ter no mínimo 6 caracteres.');
    }

    // Verifica se já existe um cadastro com senha ativa para este CPF/CNPJ
    const existingCnpj = await clientRepository.findByCnpjWithAuth(db, cleanDoc);
    if (existingCnpj && existingCnpj.passwordHash) {
      throw new ValidationError('Este documento já possui cadastro ativo. Por favor, acerte a senha ou faça login.');
    }

    // Verifica se já existe um cadastro com senha para este e-mail
    const existingEmail = await clientRepository.findByEmailWithAuth(db, email);
    if (existingEmail && existingEmail.passwordHash && existingEmail.cnpj !== cleanDoc) {
      throw new ValidationError('Este e-mail já está associado a outra conta cadastrada.');
    }

    const phone = input.phone ? normalizeBrPhone(input.phone) : null;
    const passwordHash = hashPassword(input.password);

    const client = await clientRepository.upsertWithPassword(db, {
      cnpj: cleanDoc,
      companyName: input.companyName.trim(),
      tradeName: input.tradeName?.trim() || null,
      email,
      phone,
      passwordHash,
    });

    const token = createAuthToken({
      clientId: client.id,
      cnpj: client.cnpj,
    });

    return { client, token };
  }

  /**
   * Autenticação de cliente por e-mail ou CPF/CNPJ + senha.
   */
  async login(input: LoginInput, db: Queryable = pool): Promise<AuthResult> {
    const identifier = input.identifier.trim();
    if (!identifier) {
      throw new ValidationError('Informe seu e-mail ou CPF/CNPJ.');
    }
    if (!input.password) {
      throw new ValidationError('Informe sua senha.');
    }

    let client = null;
    if (identifier.includes('@')) {
      client = await clientRepository.findByEmailWithAuth(db, identifier);
    } else {
      const docDigits = onlyDigits(identifier);
      if (docDigits.length >= 11) {
        client = await clientRepository.findByCnpjWithAuth(db, docDigits);
      }
      if (!client) {
        client = await clientRepository.findByEmailWithAuth(db, identifier);
      }
    }

    if (!client || !client.passwordHash) {
      throw new UnauthorizedError('Credenciais inválidas. Verifique seu documento/e-mail e senha.');
    }

    const passwordValid = verifyPassword(input.password, client.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Credenciais inválidas. Verifique seu documento/e-mail e senha.');
    }

    const token = createAuthToken({
      clientId: client.id,
      cnpj: client.cnpj,
    });

    const { passwordHash: _removed, ...cleanClient } = client;
    return { client: cleanClient, token };
  }

  /**
   * Busca os dados do perfil do cliente autenticado.
   */
  async getProfile(clientId: string, db: Queryable = pool): Promise<Client> {
    const client = await clientRepository.findById(db, clientId);
    if (!client) {
      throw new NotFoundError('Cliente');
    }
    return client;
  }
}

export const clientService = new ClientService();
