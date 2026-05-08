// Server Actions (nuevo)
export {
  getComprasServiciosAction,
  getCompraServicioByIdAction,
  createCompraServicioAction,
  updateCompraServicioAction,
  deleteCompraServicioAction,
} from './actions';

// RTK Query (legacy)
export {
  comprasServiciosApi,
  useGetComprasServiciosQuery,
  useCreateCompraServicioMutation,
  useUpdateCompraServicioMutation,
  useDeleteCompraServicioMutation,
} from './api/comprasServiciosApi';

export type { CompraServicio } from './types';
