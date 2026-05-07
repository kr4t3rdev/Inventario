export {
  getComprasServiciosHandler,
  createCompraServicioHandler,
  getCompraServicioByIdHandler,
  updateCompraServicioHandler,
  deleteCompraServicioHandler,
} from './api/handlers';

export {
  comprasServiciosApi,
  useGetComprasServiciosQuery,
  useCreateCompraServicioMutation,
  useUpdateCompraServicioMutation,
  useDeleteCompraServicioMutation,
} from './api/comprasServiciosApi';

export type { CompraServicio } from './types';
