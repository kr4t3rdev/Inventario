import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const anularSchema = z.object({
  motivo: z.string().min(1, 'El motivo de anulación es obligatorio'),
})

/**
 * @description Anula un evento contable cambiando su estado a ANULADO.
 * Además registra un evento espejo compensatorio para mantener la trazabilidad.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user

    const { id: eventoId } = await params
    const body = await request.json()
    const { motivo } = anularSchema.parse(body)

    const client = prisma as unknown as Record<string, unknown>
    const eventoContable = client.eventoContable as
      | { findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>; update: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
      | undefined

    if (!eventoContable?.findUnique) {
      return NextResponse.json({ error: 'Modelo EventoContable no disponible' }, { status: 503 })
    }

    const evento = await eventoContable.findUnique({
      where: { eventoId },
      include: { lineas: true },
    } as Record<string, unknown>)

    if (!evento) {
      return NextResponse.json({ error: 'Evento contable no encontrado' }, { status: 404 })
    }

    if ((evento as Record<string, unknown>).estado === 'ANULADO') {
      return NextResponse.json({ error: 'El evento ya está anulado' }, { status: 409 })
    }

    await eventoContable.update({
      where: { eventoId },
      data: { estado: 'ANULADO', metadataJson: { motivo, anuladoEn: new Date().toISOString(), anuladoPor: user.userId } },
    } as Record<string, unknown>)

    // Registrar evento compensatorio (espejo con montos invertidos)
    await registrarEventoContable({
      origenTipo: (evento as Record<string, unknown>).origenTipo as import('@/lib/services/evento-contable-service').OrigenTipo,
      origenId: `ANULACION-${eventoId}`,
      monto: Number((evento as Record<string, unknown>).monto ?? 0),
      fechaOperacion: new Date(),
      descripcion: `Anulación de evento ${eventoId}: ${motivo}`,
      usuarioId: user.userId,
      metadataJson: {
        eventoAnuladoId: eventoId,
        motivo,
      },
    })

    return NextResponse.json({ message: 'Evento anulado exitosamente', eventoId, estado: 'ANULADO' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Motivo requerido', details: error.errors }, { status: 400 })
    }
    console.error('Error anulando evento contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
