import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getFacturasHandler, createFacturaHandler } from '@/features/facturas/api/handlers';

export const GET = withAuthGet(getFacturasHandler);
export const POST = withAuthPost(createFacturaHandler);
