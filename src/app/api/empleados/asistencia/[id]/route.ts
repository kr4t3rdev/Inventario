import { getAsistenciaByIdHandler, updateAsistenciaHandler, deleteAsistenciaHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getAsistenciaByIdHandler;
export const PUT = updateAsistenciaHandler;
export const DELETE = deleteAsistenciaHandler;
