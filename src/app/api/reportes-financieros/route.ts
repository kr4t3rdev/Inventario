import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getReporteFinancieroHandler, createReporteFinancieroHandler } from '@/features/reportes-financieros/api/handlers';

export const GET = withAuthGet(getReporteFinancieroHandler);
export const POST = withAuthPost(createReporteFinancieroHandler);
