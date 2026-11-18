import express from 'express';
const { Router } = express;
import { rentalService } from '../services/rental.service';

export const devRouter = Router();

devRouter.post('/rentals/:id/simulate-payment', async (req, res) => {
  const summary = await rentalService.simulatePaymentApproval(req.params.id);
  res.json({ data: summary });
});
