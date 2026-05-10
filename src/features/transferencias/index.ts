// Server Actions
export {
  getTransferenciasAction,
  getTransferenciaByIdAction,
  createTransferenciaAction,
  deleteTransferenciaAction,
} from './actions';

// Client Components
export { TransferenciasContent } from './components/transferencias-content'

export type { Transferencia, EstadoTransferencia } from './types';

// RTK Query (legacy - internal, no exportar más)