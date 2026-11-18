import express from 'express';
const { Router } = express;
import { clientService } from '../services/client.service';
import { rentalService } from '../services/rental.service';

export const clientsRouter = Router();

clientsRouter.get('/cnpj/:cnpj', async (req, res) => {
  const result = await clientService.lookupCnpj(req.params.cnpj);
  res.json({ data: result });
});

clientsRouter.get('/cnpj/:cnpj/rentals', async (req, res) => {
  const result = await rentalService.listRentalsByCnpj(req.params.cnpj);
  res.json({ data: result });
});

clientsRouter.post('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const cnpj = String(body.cnpj ?? '').trim();
  const companyName = typeof body.companyName === 'string' ? body.companyName : typeof body.company_name === 'string' ? body.company_name : undefined;
  const tradeName = typeof body.tradeName === 'string' ? body.tradeName : typeof body.trade_name === 'string' ? body.trade_name : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;
  const phone = typeof body.phone === 'string' ? body.phone : undefined;

  const client = await clientService.ensureClient({
    cnpj,
    companyName,
    tradeName,
    email,
    phone,
  });

  res.status(201).json({ data: client });
});
