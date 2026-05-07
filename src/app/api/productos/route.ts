import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import {
  getProductosHandler,
  createProductoHandler,
} from '@/features/productos/api/handlers';

export const GET = withAuthGet(getProductosHandler);
export const POST = withAuthPost(createProductoHandler);
