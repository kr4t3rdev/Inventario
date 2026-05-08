// Server Actions (nuevo)
export {
  getEmpleadosAction,
  getEmpleadoByIdAction,
  createEmpleadoAction,
  updateEmpleadoAction,
  deleteEmpleadoAction,
} from './actions';

// RTK Query (legacy)
export {
  empleadosApi,
  useGetEmpleadosQuery,
  useGetEmpleadoQuery,
  useAddEmpleadoMutation,
  useUpdateEmpleadoMutation,
  useDeleteEmpleadoMutation,
} from './api/empleadosApi';

export type { Empleado } from './types';
