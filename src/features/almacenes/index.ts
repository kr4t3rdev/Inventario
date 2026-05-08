// Server Actions (nuevo)
export {
  getAlmacenesAction,
  getAlmacenByIdAction,
  createAlmacenAction,
  updateAlmacenAction,
  deleteAlmacenAction,
} from './actions';

// RTK Query (legacy — mantener hasta migrar todos los consumidores)
export { almacenesApi, useGetAlmacenesQuery, useGetAlmacenQuery, useAddAlmacenMutation, useUpdateAlmacenMutation, useDeleteAlmacenMutation } from './api/almacenesApi';
export { AlmacenForm } from './components/almacen-form';
export type { Almacen } from './api/almacenesApi';
