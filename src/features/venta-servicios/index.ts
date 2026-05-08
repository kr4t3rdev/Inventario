// Server Actions (nuevo)
export {
  getVentaServiciosAction,
  getVentaServicioByIdAction,
  createVentaServicioAction,
  updateVentaServicioAction,
  deleteVentaServicioAction,
} from './actions';

// RTK Query (legacy)
export {
  ventaServiciosApi,
  useGetVentaServiciosQuery,
  useGetVentaServicioByIdQuery,
  useAddVentaServicioMutation,
  useUpdateVentaServicioMutation,
  useDeleteVentaServicioMutation,
} from './api/ventaServiciosApi';

export type { VentaServicio } from './types';
