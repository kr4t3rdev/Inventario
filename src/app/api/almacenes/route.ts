import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getAlmacenesHandler, createAlmacenHandler } from '@/features/almacenes/api/handlers';

export const GET = withAuthGet(getAlmacenesHandler);
export const POST = withAuthPost(createAlmacenHandler);
