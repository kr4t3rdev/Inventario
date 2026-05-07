export {
  getTransferenciasHandler,
  createTransferenciaHandler,
  getTransferenciaByIdHandler,
  updateTransferenciaHandler,
  deleteTransferenciaHandler,
  enviarTransferenciaHandler,
  confirmarTransferenciaHandler,
  notificarTransferenciaHandler,
} from './api/handlers';

export {
  transferenciasApi,
  useGetTransferenciasQuery,
  useGetTransferenciaQuery,
  useAddTransferenciaMutation,
  useUpdateTransferenciaMutation,
  useDeleteTransferenciaMutation,
} from './api/transferenciasApi';

export type { Transferencia, EstadoTransferencia } from './types';
