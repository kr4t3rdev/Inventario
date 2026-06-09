import { getVacacionByIdHandler, updateVacacionHandler, deleteVacacionHandler } from '@/features/empleados/api/handlers';
import { withAuth, withAuthGet } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getVacacionByIdHandler);
export const PUT = withAuth(updateVacacionHandler);
export const DELETE = withAuth(deleteVacacionHandler);
