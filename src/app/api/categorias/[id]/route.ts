import { getCategoriaByIdHandler, updateCategoriaHandler, deleteCategoriaHandler } from '@/features/categorias/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getCategoriaByIdHandler;
export const PATCH = updateCategoriaHandler;
export const DELETE = deleteCategoriaHandler;
