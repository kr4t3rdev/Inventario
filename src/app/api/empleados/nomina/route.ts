import { getNominaHandler, calculateNominaHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getNominaHandler;
export const POST = calculateNominaHandler;
