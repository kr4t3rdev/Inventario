// Server Actions
export {
  getClientesAction,
  getClienteByIdAction,
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
} from './actions';

// Hooks
export { useClientes } from './hooks/use-clientes';

export { ClienteForm } from './components/clientes-form';
export type { Cliente } from './types';
