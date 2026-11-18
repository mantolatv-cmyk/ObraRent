import express, { type Request, type Response } from 'express';
const { Router } = express;
import { verifyAuthToken } from '../lib/auth';
import { UnauthorizedError, ValidationError } from '../lib/errors';
import { clientService } from '../services/client.service';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const cnpj = String(body.cnpj ?? '').trim();
  const companyName = String(body.companyName ?? body.name ?? body.company_name ?? '').trim();
  const tradeName = body.tradeName ? String(body.tradeName).trim() : undefined;
  const email = String(body.email ?? '').trim();
  const phone = body.phone ? String(body.phone).trim() : undefined;
  const password = String(body.password ?? '');

  if (!cnpj || !companyName || !email || !password) {
    throw new ValidationError('Preencha todos os campos obrigatórios: CPF/CNPJ, Nome, E-mail e Senha.');
  }

  const result = await clientService.register({
    cnpj,
    companyName,
    tradeName,
    email,
    phone: phone ?? '',
    password,
  });

  res.status(201).json({ data: result });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const identifier = String(body.identifier ?? body.email ?? body.cnpj ?? '').trim();
  const password = String(body.password ?? '');

  if (!identifier || !password) {
    throw new ValidationError('Informe seu e-mail ou CPF/CNPJ e a senha.');
  }

  const result = await clientService.login({
    identifier,
    password,
  });

  res.json({ data: result });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Sessão não identificada. Faça login para continuar.');
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    throw new UnauthorizedError('Sessão expirada ou inválida. Por favor, faça login novamente.');
  }

  const client = await clientService.getProfile(payload.clientId);
  res.json({ data: client });
});
