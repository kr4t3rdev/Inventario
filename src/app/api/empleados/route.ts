import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getEmpleadosHandler, createEmpleadoHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getEmpleadosHandler);
export const POST = withAuthPost(createEmpleadoHandler);
