import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

/**
 * @description Obtiene logs de auditoría de licencias
 * @param request NextRequest
 * @returns NextResponse
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const licenciaId = searchParams.get('licenciaId') ?? undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))

    const where = licenciaId ? { licenciaId } : {}

    const [audits, total] = await Promise.all([
      prisma.licenciaAudit.findMany({
        where,
        include: {
          licencia: {
            select: { clave: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.licenciaAudit.count({ where }),
    ])

    return NextResponse.json({
      audits,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    })
  } catch (error) {
    console.error('Error fetching auditoría:', error)
    return NextResponse.json(
      { error: 'Error obteniendo auditoría' },
      { status: 500 }
    )
  }
})
