// Server Actions
export {
  getAlmacenesAction,
  getAlmacenByIdAction,
  createAlmacenAction,
  updateAlmacenAction,
  deleteAlmacenAction,
} from './actions';

// Hooks
export { useAlmacenes } from './hooks/use-almacenes';
export type { Almacen } from '@/app/models/model';
