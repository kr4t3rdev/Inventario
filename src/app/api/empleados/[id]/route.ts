import { getEmpleadoByIdHandler, updateEmpleadoHandler, deleteEmpleadoHandler } from '@/features/empleados/api/handlers';

export const dynamic = 'force-dynamic';

export const GET = getEmpleadoByIdHandler;
export const PATCH = updateEmpleadoHandler;
export const DELETE = deleteEmpleadoHandler;
