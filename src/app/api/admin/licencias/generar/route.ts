import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { generarLicenciasSchema } from '@/lib/admin/schemas-licencias'
import { getIdempotentResult, setIdempotentResult } from '@/lib/idempotency'
import { licenseCreationCounter } from '@/lib/metrics'

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segmentos = 4
  const longitudSegmento = 5
  const claves: string[] = []

  for (let s = 0; s < segmentos; s++) {
    let segmento = ''
    for (let i = 0; i < longitudSegmento; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    claves.push(segmento)
  }

  return claves.join('-')
}

/**
 * @description Genera licencias en lote
 * @param request NextRequest
 * @returns NextResponse
 */
export const POST = withAuthPost(
  async (request: NextRequest, _context: unknown, user: any) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = generarLicenciasSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { planId, cantidad, duracionDias, idempotencyKey } = parsed.data

    const plan = await prisma.plan.findUnique({ where: { planId } })
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan no encontrado' },
        { status: 404 }
      )
    }

    const dias =
      typeof duracionDias === 'number' && duracionDias > 0
        ? duracionDias
        : plan.duracionDias

    const resultados: { clave: string; expiracion: Date }[] = []

    if (idempotencyKey) {
      const cached = await getIdempotentResult<{
        cantidad: number
        plan: string
        dias: number
        licencias: { clave: string; expiracion: string }[]
      }>(`idem:licencias:generar:${idempotencyKey}`)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < cantidad; i++) {
          let clave = generarClave()
          for (let intentos = 0; intentos < 5; intentos++) {
            const existente = await tx.licencia.findUnique({
              where: { clave },
            })
            if (!existente) break
            clave = generarClave()
          }

          const expiracion = new Date()
          expiracion.setDate(expiracion.getDate() + dias)

          const licencia = await tx.licencia.create({
            data: {
              clave,
              planId,
              expiracion,
              activa: true,
            },
            select: { clave: true, expiracion: true },
          })

          licenseCreationCounter.inc({ plan: plan.nombre, origen: 'admin' })
          resultados.push(licencia)
        }

        // Auditoría batch
        await tx.licenciaAudit.create({
          data: {
            licenciaId: 'batch',
            accion: 'GENERACION_BATCH',
            realizadoPor: user.userId,
            ip: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            detalles: JSON.stringify({
              cantidad,
              plan: plan.nombre,
              dias,
              planId,
            }),
          },
        })
      })
    } catch (e) {
      console.error('Error generando licencias:', e)
      return NextResponse.json(
        { error: 'Error generando licencias' },
        { status: 500 }
      )
    }

    const responsePayload = {
      cantidad: resultados.length,
      plan: plan.nombre,
      dias,
      licencias: resultados.map((r) => ({
        ...r,
        expiracion: r.expiracion.toISOString(),
      })),
    }

    if (idempotencyKey) {
      await setIdempotentResult(
        `idem:licencias:generar:${idempotencyKey}`,
        responsePayload
      )
    }

    return NextResponse.json(responsePayload)
  }
)
