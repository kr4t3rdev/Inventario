import { withAuth } from '@/lib/auth-middleware';
import { getSerieFacturacionByIdHandler, updateSerieFacturacionHandler, deleteSerieFacturacionHandler } from '@/features/series-facturacion/api/handlers';

export const GET = withAuth(getSerieFacturacionByIdHandler);
export const PUT = withAuth(updateSerieFacturacionHandler);
export const DELETE = withAuth(deleteSerieFacturacionHandler);
