import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getTransferenciasHandler, createTransferenciaHandler } from '@/features/transferencias/api/handlers';

export const GET = withAuthGet(getTransferenciasHandler);
export const POST = withAuthPost(createTransferenciaHandler);
