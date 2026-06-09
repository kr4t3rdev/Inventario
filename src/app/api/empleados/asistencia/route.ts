import { getAsistenciaHandler, postAsistenciaHandler } from '@/features/empleados/api/handlers';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getAsistenciaHandler);
export const POST = withAuthPost(postAsistenciaHandler);
