import { getVacacionByIdHandler, updateVacacionHandler, deleteVacacionHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getVacacionByIdHandler;
export const PUT = updateVacacionHandler;
export const DELETE = deleteVacacionHandler;
