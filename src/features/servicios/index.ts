// Server Actions
export {
  getServiciosAction,
  getServicioByIdAction,
  createServicioAction,
  updateServicioAction,
  deleteServicioAction,
} from './actions';

// Validation schemas (para componentes que necesiten el schema oficial)
export { servicioSchema, servicioUpdateSchema } from './schemas';

// Feature-specific types
export type {
  Servicios,
  ServicioResponse,
  ServicioInput,
  ServicioUpdateInput,
} from './types';

// Client Components
export { ServiciosCart, ServiciosPrestadosForm, ServiciosRecibidosForm, ServiciosRecibidosTable } from './components';
export { ServiciosContent } from './components/servicios-content';