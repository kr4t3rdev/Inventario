import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { getFacturaByIdHandler, updateFacturaHandler, deleteFacturaHandler } from '@/features/facturas/api/handlers';

export const GET = withAuthGet(getFacturaByIdHandler);
export const PATCH = withAuth(updateFacturaHandler);
export const DELETE = withAuth(deleteFacturaHandler);
