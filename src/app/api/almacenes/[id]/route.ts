import { getAlmacenByIdHandler, updateAlmacenHandler, deleteAlmacenHandler } from '@/features/almacenes/api/handlers';

export const GET = getAlmacenByIdHandler;
export const PATCH = updateAlmacenHandler;
export const DELETE = deleteAlmacenHandler;
