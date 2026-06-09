import { getAsistenciaByIdHandler, updateAsistenciaHandler, deleteAsistenciaHandler } from '@/features/empleados/api/handlers';
import { withAuth, withAuthGet } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getAsistenciaByIdHandler);
export const PUT = withAuth(updateAsistenciaHandler);
export const DELETE = withAuth(deleteAsistenciaHandler);
