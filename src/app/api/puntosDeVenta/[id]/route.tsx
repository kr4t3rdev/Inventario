import {
  getPuntoDeVentaByIdHandler,
  updatePuntoDeVentaHandler,
  deletePuntoDeVentaHandler,
} from '@/features/puntos-venta/api/handlers';

export const GET = getPuntoDeVentaByIdHandler;
export const PATCH = updatePuntoDeVentaHandler;
export const DELETE = deletePuntoDeVentaHandler;
