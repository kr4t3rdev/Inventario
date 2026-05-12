import { withAuthGet } from '@/lib/auth-middleware';
import { getVentasStatsHandler } from '@/features/ventas/api/handlers';

export const GET = withAuthGet(getVentasStatsHandler);
