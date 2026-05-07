import { withAuthGet } from '@/lib/auth-middleware';
import { exportComprasProductosHandler } from '@/features/compras-productos/api/handlers';

export const GET = withAuthGet(exportComprasProductosHandler);
