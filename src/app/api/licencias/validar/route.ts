import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { licenseValidationCounter, rateLimitCounter } from "@/lib/metrics"

type RateBucket = { count: number; reset: number }
const RATE_LIMIT = { windowMs: 60_000, max: 20 }
const globalAny = globalThis as unknown as { __licenseRateLimit?: Map<string, RateBucket> }
if (!globalAny.__licenseRateLimit) globalAny.__licenseRateLimit = new Map()
const store = globalAny.__licenseRateLimit

function rateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket || now > bucket.reset) {
    store.set(key, { count: 1, reset: now + RATE_LIMIT.windowMs })
    return true
  }
  if (bucket.count < RATE_LIMIT.max) {
    bucket.count++
    return true
  }
  return false
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const rl = await checkRateLimit(`validate:${ip}`, 60_000, 20, "licencias")
  if (!rl.allowed) {
    rateLimitCounter.inc({ endpoint: 'validate', ip })
    const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
    res.headers.set("Retry-After", Math.ceil(rl.resetMs / 1000).toString())
    return res
  }
  const { clave } = await request.json()

  if (!clave) {
    return NextResponse.json({ error: "Clave de licencia requerida" }, { status: 400 })
  }

  const licencia = await prisma.licencia.findUnique({
    where: { clave },
    include: {
      plan: true,
      usuario: { select: { userId: true, name: true, email: true } },
    },
  })

  if (!licencia) {
    return NextResponse.json({ valida: false, error: "Licencia no encontrada" }, { status: 404 })
  }

  const userAgent = request.headers.get("user-agent") || "unknown"

  if (!licencia.activa) {
    // Auditoría de intento fallido
    await prisma.licenciaAudit.create({
      data: {
        licenciaId: licencia.licenciaId,
        accion: "VALIDACION_FALLIDA",
        detalles: JSON.stringify({ motivo: "Licencia revocada" }),
        ip,
        userAgent
      }
    })
    return NextResponse.json({ valida: false, error: "Licencia revocada" })
  }

  const ahora = new Date()
  if (licencia.expiracion < ahora) {
    licenseValidationCounter.inc({ status: 'invalid', reason: 'expired' })
    // Auditoría de intento fallido
    await prisma.licenciaAudit.create({
      data: {
        licenciaId: licencia.licenciaId,
        accion: "VALIDACION_FALLIDA",
        detalles: JSON.stringify({ motivo: "Licencia expirada" }),
        ip,
        userAgent
      }
    })
    return NextResponse.json({ valida: false, error: "Licencia expirada" })
  }

  // Auditoría de éxito (opcional: muestrear si hay mucho tráfico)
  await prisma.licenciaAudit.create({
    data: {
      licenciaId: licencia.licenciaId,
      accion: "VALIDACION_EXITOSA",
      ip,
      userAgent
    }
  })

  const diasRestantes = Math.ceil(
    (licencia.expiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
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
