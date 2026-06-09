import { getVacacionAccumulacionHandler, calculateVacacionAccumulacionHandler } from '@/features/empleados/api/handlers';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getVacacionAccumulacionHandler);
export const POST = withAuthPost(calculateVacacionAccumulacionHandler);
