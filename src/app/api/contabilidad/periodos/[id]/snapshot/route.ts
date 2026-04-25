import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { authenticateUser } from '@/lib/auth-middleware';
import { buildPeriodCode, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

interface SnapshotResult {
  snapshotId: string;
  periodoId: string;
  version: number;
  baseCajaJson: unknown;
  baseDevengoJson: unknown;
  inconsistenciasJson: unknown;
  resumenJson: unknown;
  hashIntegridad: string | null;
  createdAt: string;
}

/**
 * @description Obtiene el snapshot más reciente de un período contable por su ID.
 * @param {NextRequest} request - Request HTTP.
 * @param {{ id: string }} params - ID del período.
 * @returns {Promise<NextResponse>} Snapshot del período o error.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const { id } = await params;
    const client = prisma as unknown as Record<string, unknown>;
    const snapshotPeriodo = client.snapshotPeriodo as
      | {
          findFirst: (args: Record<string, unknown>) => Promise<SnapshotResult | null>;
          findMany: (args: Record<string, unknown>) => Promise<SnapshotResult[]>;
        }
      | undefined;

    if (!snapshotPeriodo?.findFirst) {
      return NextResponse.json(
        { error: 'El runtime Prisma actual no expone SnapshotPeriodo. Ejecutá migrate/generate.', code: 'SNAPSHOT_PERSISTENCE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const { searchParams } = request.nextUrl;
    const allVersions = searchParams.get('all') === 'true';

    if (allVersions) {
      const snapshots = await snapshotPeriodo.findMany({
        where: { periodoId: id },
        orderBy: { version: 'desc' },
      });

      return NextResponse.json({ snapshots, total: snapshots.length }, { status: 200 });
    }

    const snapshot = await snapshotPeriodo.findFirst({
      where: { periodoId: id },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: `No se encontró snapshot para el período ${id}.`, code: 'SNAPSHOT_NO_ENCONTRADO' },
        { status: 404 }
      );
    }

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error('Error al obtener snapshot del período:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}