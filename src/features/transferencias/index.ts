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

export type { Transferencia, EstadoTransferencia } from './types';
