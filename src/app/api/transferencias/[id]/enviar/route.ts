import { withAuth } from '@/lib/auth-middleware';
import { enviarTransferenciaHandler } from '@/features/transferencias/api/handlers';

export const PATCH = withAuth(enviarTransferenciaHandler);
