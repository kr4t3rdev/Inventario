import { getMassAccrualHandler, massAccrualHandler } from '@/features/empleados/api/handlers';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getMassAccrualHandler);
export const POST = withAuthPost(massAccrualHandler);
