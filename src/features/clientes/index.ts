// Server Actions
export {
  getClientesAction,
  getClienteByIdAction,
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
} from './actions';

// API Handlers (legacy)
export { getClientesHandler, createClienteHandler, getClienteByIdHandler, updateClienteHandler, deleteClienteHandler } from './api/handlers';

// Hooks
export { useClientes } from './hooks/use-clientes';

export { ClienteForm } from './components/clientes-form';
export type { Cliente } from './types';
