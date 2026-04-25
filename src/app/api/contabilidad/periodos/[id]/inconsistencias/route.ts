import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { authenticateUser } from '@/lib/auth-middleware';

/**
 * @description Obtiene las inconsistencias registradas en el snapshot de un período contable.
 * @param {NextRequest} request - Request HTTP.
 * @param {{ id: string }} params - ID del período.
 * @returns {Promise<NextResponse>} Lista de inconsistencias o error.
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
          findFirst: (args: Record<string, unknown>) => Promise<{
            snapshotId: string;
            periodoId: string;
            inconsistenciasJson: unknown;
            version: number;
            createdAt: Date;
          } | null>;
        }
      | undefined;

    if (!snapshotPeriodo?.findFirst) {
      return NextResponse.json(
        { error: 'El runtime Prisma actual no expone SnapshotPeriodo. Ejecutá migrate/generate.', code: 'SNAPSHOT_PERSISTENCE_UNAVAILABLE' },
        { status: 503 }
      );
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

    const inconsistencias = Array.isArray(snapshot.inconsistenciasJson)
      ? snapshot.inconsistenciasJson
      : [];

    return NextResponse.json(
      {
        periodoId: id,
        snapshotId: snapshot.snapshotId,
        version: snapshot.version,
        inconsistencias,
        total: inconsistencias.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error al obtener inconsistencias del período:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}