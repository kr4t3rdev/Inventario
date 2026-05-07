import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getSeriesFacturacionHandler, createSerieFacturacionHandler } from '@/features/series-facturacion/api/handlers';

export const GET = withAuthGet(getSeriesFacturacionHandler);
export const POST = withAuthPost(createSerieFacturacionHandler);
