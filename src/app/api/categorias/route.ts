import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getCategoriasHandler, createCategoriaHandler } from '@/features/categorias/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getCategoriasHandler);
export const POST = withAuthPost(createCategoriaHandler);
