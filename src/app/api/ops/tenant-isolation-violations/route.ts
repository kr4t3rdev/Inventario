import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { getIsolationMode } from '@/lib/db/scoped-prisma';
import { getShadowViolationSnapshot } from '@/lib/db/shadow-violation-store';
import { isAdminRole } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * @description Expone el buffer local de violaciones shadow a administradores de plataforma.
 * @param {NextRequest} request - Solicitud autenticada mediante cookie o Bearer JWT.
 * @returns {Promise<NextResponse>} Snapshot de esta instancia o error de autorización.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await authenticateUser(request);
  if ('status' in authResult) return authResult as NextResponse;

  if (!isAdminRole(authResult.user.role)) {
    return NextResponse.json(
      { error: 'No tienes permisos para consultar este reporte operativo' },
      { status: 403 },
    );
  }

  const snapshot = getShadowViolationSnapshot();
  const instanceId = process.env.RAILWAY_REPLICA_ID
    ?? process.env.RAILWAY_DEPLOYMENT_ID
    ?? process.env.HOSTNAME
    ?? 'local';

  return NextResponse.json(
    {
      isolationMode: getIsolationMode(),
      scope: 'single-instance',
      instanceId,
      ...snapshot,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
