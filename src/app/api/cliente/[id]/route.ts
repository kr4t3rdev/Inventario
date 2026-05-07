import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { getClienteByIdHandler, updateClienteHandler, deleteClienteHandler } from '@/features/clientes/api/handlers';

export const GET = withAuthGet(getClienteByIdHandler);
export const PATCH = withAuth(updateClienteHandler);
export const DELETE = withAuth(deleteClienteHandler);
