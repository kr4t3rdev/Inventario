import { getVacacionesHandler, createVacacionHandler } from '@/features/empleados/api/handlers';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getVacacionesHandler);
export const POST = withAuthPost(createVacacionHandler);
