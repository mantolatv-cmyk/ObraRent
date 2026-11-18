import { Router } from 'express';
import { externalLookupService } from '../services/cnpj-lookup.service';

export const geoRouter = Router();

geoRouter.get('/cep/:cep', async (req, res) => {
  const address = await externalLookupService.lookupCep(req.params.cep);
  res.json({ data: address });
});
