// Server Actions (nuevo)
export {
  getClientesAction,
  getClienteByIdAction,
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
} from './actions';

// RTK Query (legacy)
export { clientesApi, useGetClientesQuery, useGetClienteQuery, useAddClienteMutation, useUpdateClienteMutation, useDeleteClienteMutation } from './api/ClienteApi';
export { ClienteForm } from './components/clientes-form';
export type { Cliente } from './types';
