import { type NextRequest } from 'next/server';

import { getPeriodosBalanceFinanciero } from '@/features/contabilidad/api/exchange-handlers';
import { type AuthenticatedUser, withAuthGet } from '@/lib/auth-middleware';

export const GET = withAuthGet(
  async (request: NextRequest, _context: unknown, user: AuthenticatedUser) =>
    getPeriodosBalanceFinanciero(request, user),
);
