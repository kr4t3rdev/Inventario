import { getVacacionesHandler, createVacacionHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getVacacionesHandler;
export const POST = createVacacionHandler;
