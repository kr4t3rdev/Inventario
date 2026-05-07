import { withAuth } from '@/lib/auth-middleware';
import {
  getProductoByIdHandler,
  updateProductoHandler,
  deleteProductoHandler,
} from '@/features/productos/api/handlers';

export const GET = withAuth(getProductoByIdHandler);
export const PATCH = withAuth(updateProductoHandler);
export const DELETE = withAuth(deleteProductoHandler);
