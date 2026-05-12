import { withAuth } from '@/lib/auth-middleware';
import {
  getVentaByIdHandler,
  updateVentaHandler,
  deleteVentaHandler,
} from '@/features/ventas/api/handlers';

export const GET = withAuth(getVentaByIdHandler);
export const PATCH = withAuth(updateVentaHandler);
export const DELETE = withAuth(deleteVentaHandler);
