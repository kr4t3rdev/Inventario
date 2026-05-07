import { getUnidadByIdHandler, updateUnidadHandler, deleteUnidadHandler } from '@/features/unidades/api/handlers';

export const GET = getUnidadByIdHandler;
export const PATCH = updateUnidadHandler;
export const DELETE = deleteUnidadHandler;
