export {
  activateRental,
  api,
  cancelRental,
  dispatchRental,
  extendRental,
  getClientRentalsByCnpj,
  getFleet,
  getRentalContract,
  getWhatsappSession,
  listRentals,
  resetWhatsappSession,
  returnRental,
  sendWhatsappBotMessage,
  simulatePayment,
  updateEquipmentItemStatus,
} from '@/lib/api/endpoints';
export { API_URL, request } from '@/lib/api/client';
export { ApiError, errorMessage, isApiError } from '@/lib/api/errors';
