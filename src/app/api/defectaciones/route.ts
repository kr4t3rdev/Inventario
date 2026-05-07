import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'

const DefectacionSchema = z.object({
  defecto: z.string().min(1),
  costo: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const defectaciones = await prisma.defectacionCatalogo.findMany({ orderBy: { defecto: 'asc' } })
    const payload = defectaciones.map((d: any) => ({ id: d.id, defecto: d.defecto, costo: d.costo }))
    return NextResponse.json({ defectaciones: payload })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al leer defectaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const tenantId = requireTenant(authResult.user)
    const body = await request.json()
    const def = DefectacionSchema.parse(body)
    const created = await prisma.defectacionCatalogo.create({
      data: {
        tenantId,
        defecto: def.defecto,
        costo: Math.round(def.costo)
      }
    })
    return NextResponse.json({ id: created.id, defecto: created.defecto, costo: created.costo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al crear defecto' }, { status: 400 })
  }
}
