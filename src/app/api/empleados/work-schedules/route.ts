import { getWorkSchedulesHandler, upsertWorkScheduleHandler, deleteWorkScheduleHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getWorkSchedulesHandler;
export const POST = upsertWorkScheduleHandler;
export const DELETE = deleteWorkScheduleHandler;
