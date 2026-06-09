import { getWorkSchedulesHandler, upsertWorkScheduleHandler, deleteWorkScheduleHandler } from '@/features/empleados/api/handlers';
import { withAuth, withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getWorkSchedulesHandler);
export const POST = withAuthPost(upsertWorkScheduleHandler);
export const DELETE = withAuth(deleteWorkScheduleHandler);
