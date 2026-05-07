import { withAuth } from '@/lib/auth-middleware';
import { bulkUpdateStockMinimoHandler } from '@/features/productos/api/handlers';

export const POST = withAuth(bulkUpdateStockMinimoHandler);
