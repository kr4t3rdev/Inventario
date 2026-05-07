import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getClientesHandler, createClienteHandler } from '@/features/clientes/api/handlers';

export const GET = withAuthGet(getClientesHandler);
export const POST = withAuthPost(createClienteHandler);
