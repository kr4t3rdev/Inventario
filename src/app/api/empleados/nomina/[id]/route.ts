import { getNominaByIdHandler, updateNominaHandler, deleteNominaHandler } from '@/features/empleados/api/handlers';
import { withAuth, withAuthGet } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getNominaByIdHandler);
export const PUT = withAuth(updateNominaHandler);
export const DELETE = withAuth(deleteNominaHandler);
