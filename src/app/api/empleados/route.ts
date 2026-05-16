import { getEmpleadosHandler } from '@/features/empleados/api/handlers';
import { withAuthGet } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getEmpleadosHandler);
