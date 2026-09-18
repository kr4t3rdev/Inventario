import { NextRequest, NextResponse } from 'next/server';

import {
  cleanupSalesAgentEmailDeliveries,
  processDueSalesAgentEmailDeliveries,
} from '@/features/sales-agent/services/notification-service';

/**
 * @description Procesa el outbox de Gestores y aplica retención mediante un secreto de cron.
 * @param {NextRequest} request - Solicitud con Authorization Bearer.
 * @returns {Promise<NextResponse>} Contadores operativos sin datos financieros.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [delivery, cleanup] = await Promise.all([
    processDueSalesAgentEmailDeliveries(),
    cleanupSalesAgentEmailDeliveries(),
  ]);
  return NextResponse.json({ success: true, delivery, cleanup });
}
