import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getComprasProductosHandler, createCompraProductoHandler } from '@/features/compras-productos/api/handlers';

export const GET = withAuthGet(getComprasProductosHandler);
export const POST = withAuthPost(createCompraProductoHandler);
