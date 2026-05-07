import { getNominaByIdHandler, updateNominaHandler, deleteNominaHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getNominaByIdHandler;
export const PUT = updateNominaHandler;
export const DELETE = deleteNominaHandler;
