import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { getIdempotentResult, setIdempotentResult } from '@/lib/idempotency'
import { licenseValidationCounter, rateLimitCounter, licenseCreationCounter } from '@/lib/metrics'

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = 4
  const len = 5
  const parts: string[] = []
  for (let s = 0; s < seg; s++) {
    let segmento = ''
    for (let i = 0; i < len; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    parts.push(segmento)
  }
  return parts.join('-')
}

export async function listLicencias(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const licencias = await prisma.licencia.findMany({
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(licencias)
  } catch (error) {
    console.error('Error fetching licencias:', error)
    return NextResponse.json({ error: 'Error fetching licencias' }, { status: 500 })
  }
}

export async function createLicencia(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { clave, usuarioId, planId, duracionDias } = body

  if (!usuarioId || !planId) {
    return NextResponse.json({ error: 'Usuario y plan son requeridos' }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const usuario = await prisma.user.findUnique({ where: { userId: usuarioId } })
  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (duracionDias !== undefined) {
    const n = Number(duracionDias)
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: 'duracionDias debe ser un entero positivo' }, { status: 400 })
    }
  }

  const expiracion = new Date()
  expiracion.setDate(expiracion.getDate() + (duracionDias || plan.duracionDias))

  try {
    const licenseKey =
      typeof clave === 'string' && clave.trim().length > 0
        ? clave.trim()
        : (() => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            const seg = 4
            const len = 5
            const parts: string[] = []
            for (let s = 0; s < seg; s++) {
              let segmento = ''
              for (let i = 0; i < len; i++) {
                segmento += chars.charAt(Math.floor(Math.random() * chars.length))
              }
              parts.push(segmento)
            }
            return parts.join('-')
          })()

    const licencia = await prisma.$transaction(async (tx) => {
      const nuevaLicencia = await tx.licencia.create({
        data: { clave: licenseKey, usuarioId, planId, expiracion },
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
      })

      await tx.user.update({
        where: { userId: usuarioId },
        data: { expiresAt: expiracion },
      })

      await tx.licenciaAudit.create({
        data: {
          licenciaId: nuevaLicencia.licenciaId,
          accion: 'CREACION',
          realizadoPor: user.userId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          detalles: JSON.stringify({
            plan: plan.nombre,
            duracionDias: duracionDias || plan.duracionDias,
            expiracion: expiracion.toISOString(),
          }),
        },
      })

      return nuevaLicencia
    })

    return NextResponse.json(licencia, { status: 201 })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'La clave de licencia ya existe' }, { status: 409 })
    }
    console.error('Error creando licencia:', error)
    return NextResponse.json({ error: 'Error creando licencia' }, { status: 500 })
  }
}

export async function getLicencia(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const licencia = await prisma.licencia.findUnique({
    where: { licenciaId: id },
    include: {
      usuario: { select: { userId: true, name: true, email: true } },
      plan: true,
    },
  })

  if (!licencia) {
    return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })
  }

  return NextResponse.json(licencia)
}

export async function updateLicencia(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const { activa, expiracion, usuarioId } = body

  const licenciaActual = await prisma.licencia.findUnique({
    where: { licenciaId: id },
    select: { usuarioId: true, expiracion: true },
  })

  if (!licenciaActual) {
    return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })
  }

  const nuevaExpiracion = expiracion ? new Date(expiracion) : licenciaActual.expiracion

  const licencia = await prisma.$transaction(async (tx) => {
    const licUpdated = await tx.licencia.update({
      where: { licenciaId: id },
      data: {
        ...(activa !== undefined && { activa }),
        ...(expiracion && { expiracion: nuevaExpiracion }),
        ...(usuarioId && { usuarioId }),
      },
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
    })

    if (activa === true || expiracion) {
      const targetUserId = usuarioId || licenciaActual.usuarioId
      await tx.user.update({
        where: { userId: targetUserId },
        data: { expiresAt: nuevaExpiracion },
      })
    }

    return licUpdated
  })

  return NextResponse.json(licencia)
}

export async function deleteLicencia(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params
  await prisma.licencia.delete({ where: { licenciaId: id } })
  return NextResponse.json({ message: 'Licencia eliminada' })
}

export async function generarLicencias(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { planId, cantidad = 1, duracionDias, idempotencyKey: keyFromBody } = body
  const idemHeader = request.headers.get('idempotency-key') || undefined
  const idempotencyKey = (keyFromBody || idemHeader)?.toString().trim()

  if (!planId) {
    return NextResponse.json({ error: 'Plan requerido' }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const dias = typeof duracionDias === 'number' && duracionDias > 0 ? duracionDias : plan.duracionDias
  if (!Number.isFinite(dias) || dias <= 0) {
    return NextResponse.json({ error: 'Duración inválida' }, { status: 400 })
  }

  const target = Math.max(1, Math.min(1000, Number(cantidad) || 1))
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
      for (let i = 0; i < target; i++) {
        let clave = generarClave()
        for (let intentos = 0; intentos < 5; intentos++) {
          const existente = await tx.licencia.findUnique({ where: { clave } })
          if (!existente) break
          clave = generarClave()
        }

        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + dias)

        const licencia = await tx.licencia.create({
          data: { clave, planId, expiracion, activa: true, usuarioId: user.userId },
          select: { clave: true, expiracion: true },
        })
        licenseCreationCounter.inc({ plan: plan.nombre, origen: 'api' })
        resultados.push(licencia)
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Error generando licencias' }, { status: 500 })
  }

  const responsePayload = {
    cantidad: resultados.length,
    plan: plan.nombre,
    dias,
    licencias: resultados.map((r) => ({ ...r, expiracion: r.expiracion.toISOString() })),
  }

  if (idempotencyKey) {
    await setIdempotentResult(`idem:licencias:generar:${idempotencyKey}`, responsePayload)
  }

  return NextResponse.json(responsePayload)
}

export async function validarLicencia(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit(ip, '/api/licencias/validate')
  if (!rl.allowed) {
    rateLimitCounter.inc({ endpoint: 'validate', ip })
    const res = NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
    res.headers.set('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000).toString())
    return res
  }

  const { clave } = await request.json()

  if (!clave) {
    return NextResponse.json({ error: 'Clave de licencia requerida' }, { status: 400 })
  }

  const licencia = await prisma.licencia.findUnique({
    where: { clave },
    include: {
      plan: true,
      usuario: { select: { userId: true, name: true, email: true } },
    },
  })

  if (!licencia) {
    return NextResponse.json({ valida: false, error: 'Licencia no encontrada' }, { status: 404 })
  }

  const userAgent = request.headers.get('user-agent') || 'unknown'

  if (!licencia.activa) {
    await prisma.licenciaAudit.create({
      data: {
        licenciaId: licencia.licenciaId,
        accion: 'VALIDACION_FALLIDA',
        detalles: JSON.stringify({ motivo: 'Licencia revocada' }),
        ip,
        userAgent,
      },
    })
    return NextResponse.json({ valida: false, error: 'Licencia revocada' })
  }

  const ahora = new Date()
  if (licencia.expiracion < ahora) {
    licenseValidationCounter.inc({ status: 'invalid', reason: 'expired' })
    await prisma.licenciaAudit.create({
      data: {
        licenciaId: licencia.licenciaId,
        accion: 'VALIDACION_FALLIDA',
        detalles: JSON.stringify({ motivo: 'Licencia expirada' }),
        ip,
        userAgent,
      },
    })
    return NextResponse.json({ valida: false, error: 'Licencia expirada' })
  }

  await prisma.licenciaAudit.create({
    data: {
      licenciaId: licencia.licenciaId,
      accion: 'VALIDACION_EXITOSA',
      ip,
      userAgent,
    },
  })

  const diasRestantes = Math.ceil(
    (licencia.expiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24),
  )

  return NextResponse.json({
    valida: true,
    licencia: {
      licenciaId: licencia.licenciaId,
      clave: licencia.clave,
      plan: licencia.plan,
      inicio: licencia.inicio,
      expiracion: licencia.expiracion,
      diasRestantes,
    },
  })
}
