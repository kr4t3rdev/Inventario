import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const createSchema = z.object({
  eventoOriginalId: z.string().min(1),
  monto: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es obligatorio'),
  esAjusteTotal: z.boolean().optional().default(true),
})

/**
 * @description Crea un ajuste compensatorio para un evento contable original.
 * El ajuste invierte los montos (débito ↔ crédito) para compensar el impacto del evento original.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user

    const body = await request.json()
    const data = createSchema.parse(body)

    await assertOperationAllowed(new Date(), 'AJUSTE_CONTABLE')

    const client = prisma as unknown as Record<string, unknown>
    const eventoContable = client.eventoContable as
      | { findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null> }
      | undefined

    if (!eventoContable?.findUnique) {
      return NextResponse.json({ error: 'Modelo EventoContable no disponible' }, { status: 503 })
    }

    const eventoOriginal = await eventoContable.findUnique({
      where: { eventoId: data.eventoOriginalId },
      include: { lineas: true },
    } as Record<string, unknown>)

    if (!eventoOriginal) {
      return NextResponse.json({ error: 'Evento original no encontrado' }, { status: 404 })
    }

    await registrarEventoContable({
      origenTipo: 'AJUSTE_CONTABLE',
      origenId: `COMPENSACION-${data.eventoOriginalId}-${Date.now()}`,
      monto: data.monto,
      fechaOperacion: new Date(),
      descripcion: `Ajuste compensatorio: ${data.motivo}`,
      usuarioId: user.userId,
      metadataJson: {
        eventoOriginalId: data.eventoOriginalId,
        esAjusteTotal: data.esAjusteTotal,
        motivo: data.motivo,
      },
    })

    return NextResponse.json({
      message: 'Ajuste compensatorio registrado exitosamente',
      eventoOriginalId: data.eventoOriginalId,
      monto: data.monto,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Error creando ajuste compensatorio:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
