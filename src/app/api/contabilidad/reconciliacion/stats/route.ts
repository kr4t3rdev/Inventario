import { NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import {
  getReconciliationStats,
} from '@/features/contabilidad/services/reconciliation-stats-service';
import type { NextRequest } from 'next/server';

/**
 * @description Returns tenant-scoped reconciliation statistics for the web accounting API.
 * @param {NextRequest} request - Authenticated API request.
 * @returns {Promise<Response>} Raw snapshot or the existing authentication/error response.
 */
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser) return authResultUser as Response;

    const tenantId = requireTenant(authResultUser.user);
    const snapshot = await getReconciliationStats({ tenantId });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Error fetching reconciliation stats:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
