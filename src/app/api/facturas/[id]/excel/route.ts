import { withAuth } from '@/lib/auth-middleware';
import { generateExcelHandler } from '@/features/facturas/api/handlers';

export const runtime = "nodejs"

export const GET = withAuth(generateExcelHandler);
