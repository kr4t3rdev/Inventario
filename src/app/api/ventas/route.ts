import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import {
  getVentasHandler,
  createVentaHandler,
} from '@/features/ventas/api/handlers';

export const GET = withAuthGet(getVentasHandler);
export const POST = withAuthPost(createVentaHandler);
