import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { getCompraProductoByIdHandler, updateCompraProductoHandler, deleteCompraProductoHandler } from '@/features/compras-productos/api/handlers';

export const GET = withAuthGet(getCompraProductoByIdHandler);
export const PUT = withAuth(updateCompraProductoHandler);
export const DELETE = withAuth(deleteCompraProductoHandler);
