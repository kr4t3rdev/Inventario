import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"
import { getIdempotentResult, setIdempotentResult } from "@/lib/idempotency"
import { idempotencyCounter, licenseCreationCounter } from "@/lib/metrics"

function generarClave(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const segmentos = 4
  const longitudSegmento = 5
  const claves: string[] = []

  for (let s = 0; s < segmentos; s++) {
    let segmento = ""
    for (let i = 0; i < longitudSegmento; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    claves.push(segmento)
  }

  return claves.join("-")
}

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { planId, cantidad = 1, duracionDias, idempotencyKey: keyFromBody } = body
  const idemHeader = request.headers.get("idempotency-key") || undefined
  const idempotencyKey = (keyFromBody || idemHeader)?.toString().trim()

  if (!planId) {
    return NextResponse.json({ error: "Plan requerido" }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
  }

  const dias = typeof duracionDias === "number" && duracionDias > 0 ? duracionDias : plan.duracionDias
  if (!Number.isFinite(dias) || dias <= 0) {
    return NextResponse.json({ error: "Duración inválida" }, { status: 400 })
  }

  const target = Math.max(1, Math.min(1000, Number(cantidad) || 1))
  const resultados: { clave: string; expiracion: Date }[] = []

  if (idempotencyKey) {
    const cached = await getIdempotentResult<{ cantidad: number; plan: string; dias: number; licencias: { clave: string; expiracion: string }[] }>(`idem:licencias:generar:${idempotencyKey}`)
    if (cached) {
      return NextResponse.json(cached)
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < target; i++) {
        let clave = generarClave()
        // Intentar hasta 5 veces por colisiones de clave
        for (let intentos = 0; intentos < 5; intentos++) {
          const existente = await tx.licencia.findUnique({ where: { clave } })
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
            usuarioId: user.userId,
          },
          select: { clave: true, expiracion: true },
        })
        licenseCreationCounter.inc({ plan: plan.nombre, origen: 'api' })
        resultados.push(licencia)
      }
    })
  } catch (e) {
    return NextResponse.json({ error: "Error generando licencias" }, { status: 500 })
  }

  const responsePayload = {
    cantidad: resultados.length,
    plan: plan.nombre,
    dias,
    licencias: resultados.map(r => ({ ...r, expiracion: r.expiracion.toISOString() })),
  }

  if (idempotencyKey) {
    await setIdempotentResult(`idem:licencias:generar:${idempotencyKey}`, responsePayload)
  }

  return NextResponse.json(responsePayload)
})
