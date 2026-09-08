import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { fxEvidenceService } from '@/features/contabilidad/services/fx-evidence-service';

const captureSchema = z.object({
  boundaryAt: z.coerce.date().optional(),
}).strict();

/**
 * @description Captura la evidencia histórica necesaria para convertir partidas extranjeras del balance.
 * @param {NextRequest} request - Solicitud autenticada.
 * @param {unknown} _context - Contexto de ruta no utilizado.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Response>} Resultado seguro de la captura.
 */
export const POST = withAuthPost(async (
  request: NextRequest,
  _context: unknown,
  user: AuthenticatedUser,
) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Sin contexto de tenant', code: 'NO_TENANT' },
        { status: 403 },
      );
    }
    requireFeature(user, 'contabilidad', 'registrar conversiones históricas');
    requirePermission(user, 'financiero.conversiones.registrar', 'registrar conversiones históricas');
    const tenantId = requireTenant(user);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'El cuerpo de la solicitud no es JSON válido', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }
    const parsed = captureSchema.parse(body);
    const boundaryAt = parsed.boundaryAt ?? new Date();
    const now = Date.now();
    if (boundaryAt.getTime() > now || boundaryAt.getTime() < now - 5 * 60 * 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'La captura de saldos bancarios solo admite el corte actual',
          code: 'INVALID_BOUNDARY',
        },
        { status: 400 },
      );
    }
    const result = await fxEvidenceService.captureEligible({ tenantId, boundaryAt });
    return NextResponse.json({
      success: true,
      data: { boundaryAt: boundaryAt.toISOString(), ...result },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos de entrada inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ? 403 : 400;
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status });
    }
    console.error('Error al capturar evidencia FX del balance:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo capturar la evidencia FX', code: 'FX_EVIDENCE_CAPTURE_ERROR' },
      { status: 500 },
    );
  }
});
