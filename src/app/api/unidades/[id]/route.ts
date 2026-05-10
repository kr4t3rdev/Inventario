import { getUnidadByIdHandler, updateUnidadHandler, replaceUnidadHandler, deleteUnidadHandler } from '@/features/unidades/api/handlers';

export const GET = getUnidadByIdHandler;
export const PUT = replaceUnidadHandler;
export const PATCH = updateUnidadHandler;
export const DELETE = deleteUnidadHandler;
