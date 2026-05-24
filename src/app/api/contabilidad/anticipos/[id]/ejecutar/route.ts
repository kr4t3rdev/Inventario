import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { executeAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

const ExecuteAnticipoSchema = z.object({
  contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']),
  documentoDestinoId: z.string().min(1),
  montoObjetivo: z.coerce.number().positive(),
  monedaObjetivo: z.string().min(1),
  tasaAplicada: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1),
  observaciones: z.string().optional(),
})

/**
 * @description Ejecuta un anticipo total (sin parcial).
 * La reconciliación NO se hace aquí — vive en el flujo que consume el anticipo
 * (ej: compra-productos, venta-servicios, etc.).
 * @param {NextRequest} request - Request HTTP
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta
 * @param {{ userId: string }} user - Usuario autenticado
 * @returns {Promise<NextResponse>} Resultado de la ejecución
 */
export const POST = withAuthPost(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    user: { userId: string }
  ) => {
    try {
      const { id: anticipoId } = await params
      const body = await request.json()
      const payload = ExecuteAnticipoSchema.parse(body)

      // Validar que el monto objetivo sea exactamente el saldo disponible
      const anticipo = await prisma.anticipo.findUnique({
        where: { anticipoId },
        select: { saldoDisponible: true, tenantId: true },
      })

      if (!anticipo) {
        return NextResponse.json(
          { error: 'Anticipo no encontrado', code: 'ANTICIPO_NO_ENCONTRADO' },
          { status: 404 }
        )
      }

      // Validar período contable antes de ejecutar
      const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
      const validacionPeriodo = await validarEscrituraPeriodo({
        fecha: fechaOperacion,
        tenantId: anticipo.tenantId,
        tipoOperacion: 'ejecutar_anticipo',
        actor: user.userId,
      })
      if (!validacionPeriodo.permitido) {
        return NextResponse.json(
          { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
          { status: 400 }
        )
      }

      const saldoDisponible = Number(anticipo.saldoDisponible)
      if (Math.abs(saldoDisponible - payload.montoObjetivo) > 0.000001) {
        return NextResponse.json(
          {
            error: 'La ejecución parcial del anticipo no está permitida. Debe ejecutar el saldo completo.',
            code: 'EJECUCION_PARCIAL_NO_PERMITIDA',
            saldoDisponible,
            montoObjetivo: payload.montoObjetivo,
          },
          { status: 409 }
        )
      }

      const resultado = await prisma.$transaction(async (tx) => {
        return executeAnticipo(tx, {
          anticipoId,
          contexto: payload.contexto,
          documentoDestinoId: payload.documentoDestinoId,
          montoObjetivo: payload.montoObjetivo,
          monedaObjetivo: payload.monedaObjetivo,
          tasaAplicada: payload.tasaAplicada,
          idempotencyKey: payload.idempotencyKey,
          observaciones: payload.observaciones,
          usuarioId: user.userId,
        })
      })

      return NextResponse.json({ result: resultado }, { status: 200 })
    } catch (error) {
      console.error('Error al ejecutar anticipo:', error)

      if (isAnticipoWorkflowError(error)) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      }

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Payload inválido', issues: error.flatten() },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Error al ejecutar anticipo' },
        { status: 500 }
      )
    }
  }
)
