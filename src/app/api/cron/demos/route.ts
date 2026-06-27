/**
 * @description Cron endpoint para cerrar automáticamente demos expiradas.
 *
 * Triggered by Railway Cron (GET). Process:
 * 1. Authenticate via CRON_SECRET env var (optional)
 * 2. Query active demo licenses where expiracion < now()
 * 3. Deactivate found licenses
 * 4. Return { scanned, deactivated }
 *
 * @module app/api/cron/demos
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * @description Validates the cron request via CRON_SECRET env var.
 */
function validateCronRequest(request: Request): { valid: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return { valid: true };

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  const provided = authHeader?.replace('Bearer ', '') ?? cronHeader ?? '';

  if (provided !== cronSecret) {
    return { valid: false, reason: 'Invalid cron secret' };
  }

  return { valid: true };
}

/**
 * @description GET handler executed by Railway Cron.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const validation = validateCronRequest(request);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const now = new Date();
  const expiredDemoLicenses = await prisma.tenantLicense.findMany({
    where: {
      isDemo: true,
      activa: true,
      expiracion: { lt: now },
    },
    select: {
      tenantLicenseId: true,
      tenantId: true,
      expiracion: true,
    },
  });

  if (expiredDemoLicenses.length === 0) {
    return NextResponse.json({
      scanned: 0,
      deactivated: 0,
    });
  }

  const result = await prisma.tenantLicense.updateMany({
    where: {
      tenantLicenseId: {
        in: expiredDemoLicenses.map((license) => license.tenantLicenseId),
      },
    },
    data: {
      activa: false,
    },
  });

  return NextResponse.json({
    scanned: expiredDemoLicenses.length,
    deactivated: result.count,
  });
}
