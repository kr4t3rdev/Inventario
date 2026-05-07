import {
  getVentaByIdHandler,
  updateVentaHandler,
  deleteVentaHandler,
} from '@/features/ventas/api/handlers';

export const GET = getVentaByIdHandler;
export const PATCH = updateVentaHandler;
export const DELETE = deleteVentaHandler;
