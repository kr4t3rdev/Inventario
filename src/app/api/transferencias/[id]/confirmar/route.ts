import { withAuth } from '@/lib/auth-middleware';
import { confirmarTransferenciaHandler } from '@/features/transferencias/api/handlers';

export const PATCH = withAuth(confirmarTransferenciaHandler);
