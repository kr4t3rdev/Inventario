import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { getTransferenciaByIdHandler, updateTransferenciaHandler, deleteTransferenciaHandler } from '@/features/transferencias/api/handlers';

export const GET = withAuthGet(getTransferenciaByIdHandler);
export const PATCH = withAuth(updateTransferenciaHandler);
export const DELETE = withAuth(deleteTransferenciaHandler);
