// Server Actions (nuevo)
export {
  getPuntosDeVentaAction,
  getPuntoDeVentaByIdAction,
  createPuntoDeVentaAction,
  updatePuntoDeVentaAction,
  deletePuntoDeVentaAction,
} from './actions';

// Hooks
export { usePuntosDeVenta } from './hooks/use-puntos-de-venta';
// Handlers legacy
export { createPuntoDeVentaHandler, getPuntoDeVentaByIdHandler, updatePuntoDeVentaHandler, deletePuntoDeVentaHandler } from './api/handlers';
export { PtoVentaForm } from './components/pvtoVenta-form';
export type { PuntoDeVenta } from './types';
