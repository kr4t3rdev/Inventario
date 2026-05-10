/**
 * @description Handlers REST para el feature de Unidades.
 *
 * Cada handler delega la lógica de negocio a las Server Actions correspondientes,
 * evitando duplicación de código. La función `toNextResponse` se encarga de
 * mapear el envelope `ActionResponse` a la respuesta HTTP adecuada.
 *
 * HTTP semantics:
 * - GET    → 200 OK
 * - POST   → 201 Created
 * - PUT    → 200 OK (full replace)
 * - PATCH  → 200 OK (partial update)
 * - DELETE → 204 No Content
 * - Error  → 400/401/404/409/500 según el código de error
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUnidadesAction,
  getUnidadByIdAction,
  createUnidadAction,
  updateUnidadAction,
  deleteUnidadAction,
} from '@/features/unidades/actions';
import type { ActionResponse } from '@/lib/server-actions';

// ─── Helpers ────────────────────────────────────────────────

/**
 * @description Mapea el código de error de una Server Action al status HTTP correspondiente.
 */
function errorCodeToStatus(errorCode?: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'AUTH_REQUIRED':
      return 401;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'P2002': // Prisma unique constraint violation
      return 409;
    default:
      return 500;
  }
}

/**
 * @description Convierte un `ActionResponse` en un `NextResponse` con el status HTTP adecuado.
 *
 * Si la acción fue exitosa y hay datos, retorna 200 (o 201 si `created=true`).
 * Si la acción falló, mapea el código de error al status HTTP correspondiente.
 */
function toNextResponse<T>(
  result: ActionResponse<T>,
  statusSuccess?: number
): NextResponse {
  if (result.success) {
    if (statusSuccess === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(result.data ?? null, {
      status: statusSuccess ?? 200,
    });
  }

  const status = errorCodeToStatus(result.error?.code);

  return NextResponse.json(
    {
      error: result.error?.message ?? 'Error interno del servidor',
      ...(result.error?.details ? { details: result.error.details } : {}),
    },
    { status }
  );
}

// ─── Handlers ───────────────────────────────────────────────

/**
 * @description GET /api/unidades — Lista todas las unidades.
 */
export async function getUnidadesHandler() {
  const result = await getUnidadesAction();
  return toNextResponse(result);
}

/**
 * @description POST /api/unidades — Crea una nueva unidad.
 *
 * Valida los datos con Zod, verifica unicidad de nombre y símbolo,
 * y retorna 201 Created en caso de éxito.
 */
export async function createUnidadHandler(request: NextRequest) {
  const body: unknown = await request.json();
  const result = await createUnidadAction(body as { nombre: string; simbolo: string });
  return toNextResponse(result, 201);
}

/**
 * @description GET /api/unidades/[id] — Obtiene una unidad por ID.
 */
export async function getUnidadByIdHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getUnidadByIdAction(id);
  return toNextResponse(result);
}

/**
 * @description PUT /api/unidades/[id] — Reemplaza completamente una unidad.
 *
 * Requiere TODOS los campos (full replace). Verifica unicidad excluyendo
 * el propio registro (self-update permitido).
 */
export async function replaceUnidadHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: unknown = await request.json();
  const result = await updateUnidadAction({
    unidadId: id,
    ...(body as { nombre?: string; simbolo?: string }),
  });
  return toNextResponse(result);
}

/**
 * @description PATCH /api/unidades/[id] — Actualiza parcialmente una unidad.
 *
 * Solo actualiza los campos presentes en el body. Verifica unicidad
 * solo para los campos que cambian.
 */
export async function updateUnidadHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: unknown = await request.json();
  const result = await updateUnidadAction({
    unidadId: id,
    ...(body as { nombre?: string; simbolo?: string }),
  });
  return toNextResponse(result);
}

/**
 * @description DELETE /api/unidades/[id] — Elimina una unidad.
 *
 * Retorna 204 No Content en caso de éxito.
 */
export async function deleteUnidadHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await deleteUnidadAction(id);
  return toNextResponse(result, 204);
}
