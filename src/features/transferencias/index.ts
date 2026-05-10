// Server Actions (nuevo)
export {
  getTransferenciasAction,
  getTransferenciaByIdAction,
  createTransferenciaAction,
  deleteTransferenciaAction,
} from './actions';

// RTK Query (legacy)
export {
  transferenciasApi,
  useGetTransferenciasQuery,
  useGetTransferenciaQuery,
  useAddTransferenciaMutation,
  useUpdateTransferenciaMutation,
  useDeleteTransferenciaMutation,
} from './api/transferenciasApi';

// Client Components
export { TransferenciasContent } from './components/transferencias-content'

export type { Transferencia, EstadoTransferencia } from './types';
