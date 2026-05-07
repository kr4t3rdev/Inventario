import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getListasPreciosHandler, createListaPrecioHandler } from '@/features/listas-precios/api/handlers';

export const GET = withAuthGet(getListasPreciosHandler);
export const POST = withAuthPost(createListaPrecioHandler);
