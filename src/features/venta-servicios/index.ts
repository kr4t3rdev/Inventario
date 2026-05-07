export {
  getVentaServiciosHandler,
  createVentaServicioHandler,
  getVentaServicioByIdHandler,
  updateVentaServicioHandler,
  deleteVentaServicioHandler,
} from './api/handlers';

export {
  ventaServiciosApi,
  useGetVentaServiciosQuery,
  useGetVentaServicioByIdQuery,
  useAddVentaServicioMutation,
  useUpdateVentaServicioMutation,
  useDeleteVentaServicioMutation,
} from './api/ventaServiciosApi';

export type { VentaServicio } from './types';
