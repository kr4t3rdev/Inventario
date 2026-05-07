import { withAuth } from '@/lib/auth-middleware';
import { generatePdfHandler } from '@/features/facturas/api/handlers';

export const runtime = "nodejs"

export const GET = withAuth(generatePdfHandler);
