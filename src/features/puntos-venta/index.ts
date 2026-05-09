// Server Actions (nuevo)
export {
  getPuntosDeVentaAction,
  getPuntoDeVentaByIdAction,
  createPuntoDeVentaAction,
  updatePuntoDeVentaAction,
  deletePuntoDeVentaAction,
} from './actions';

// Handlers legacy (para rutas API existentes)
export { createPuntoDeVentaHandler, getPuntoDeVentaByIdHandler, updatePuntoDeVentaHandler, deletePuntoDeVentaHandler } from './api/handlers';

// RTK Query (legacy)
export { puntosDeVentaApi, useGetPuntosDeVentaQuery, useGetPuntoDeVentaQuery } from './api/puntosDeVentaApi';
export { PtoVentaForm } from './components/pvtoVenta-form';
export type { PuntoDeVenta } from './types';
