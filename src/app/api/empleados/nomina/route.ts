import { getNominaHandler, calculateNominaHandler } from '@/features/empleados/api/handlers';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getNominaHandler);
export const POST = withAuthPost(calculateNominaHandler);
