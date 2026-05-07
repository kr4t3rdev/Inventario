import { withAuth } from '@/lib/auth-middleware';
import { getListaPrecioByIdHandler, updateListaPrecioHandler, deleteListaPrecioHandler } from '@/features/listas-precios/api/handlers';

export const GET = withAuth(getListaPrecioByIdHandler);
export const PUT = withAuth(updateListaPrecioHandler);
export const DELETE = withAuth(deleteListaPrecioHandler);
