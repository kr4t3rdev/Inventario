import { getVacacionAccumulacionHandler, calculateVacacionAccumulacionHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getVacacionAccumulacionHandler;
export const POST = calculateVacacionAccumulacionHandler;
