import { type NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { authenticateUser, withAuthGet, withAuthPost, withAuth, type AuthenticatedUser } from '@/lib/auth-middleware'
import {
  isAdminRole,
  isTenantAdminRole,
  normalizeTenantRole,
  platformRoleToTenantRole,
} from '@/lib/auth/roles'
import {
  activityLogBodySchema,
  activityLogQuerySchema,
  globalUsersQuerySchema,
  userMetricsQuerySchema,
  deleteSessionQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
  lockUserBodySchema,
  unlockUserBodySchema,
  expiringUsersBodySchema,
  expiringUsersQuerySchema,
  migrateCuentasPorPagarBodySchema,
} from '@/lib/admin/schemas'
import {
  licenciaQuerySchema,
  licenciaSchema,
  updateLicenciaSchema,
  generarLicenciasSchema,
  planSchema,
  planQuerySchema,
  updatePlanSchema,
} from '@/lib/admin/schemas-licencias'
import { getUserMetrics } from '@/lib/admin/userMetrics'
import { buildCsv } from '@/lib/admin/csv'
import { getIdempotentResult, setIdempotentResult } from '@/lib/idempotency'
import { licenseCreationCounter } from '@/lib/metrics'
import { sendNewUserNotification } from '@/lib/email'
import { validateTenantLimit } from '@/lib/services/tenant-scope'
import type { AdminFinanceMeta, AdminFinanceReport } from '@/features/admin/types'

// ────────────────────────────
// ACTIVITY LOGS
// ────────────────────────────

export async function activityLogsPOST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = activityLogBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const activityLog = await prisma.userActivityLog.create({
      data: {
        userId: parsed.data.userId,
        action: parsed.data.action,
        details: parsed.data.details || null,
        ipAddress: parsed.data.ipAddress || request.headers.get('x-forwarded-for') || null,
        userAgent: parsed.data.userAgent || request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    })

    return NextResponse.json(activityLog, { status: 201 })
  } catch (error) {
    console.error('Error creando registro de actividad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function activityLogsGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') ?? undefined
    const limit = searchParams.get('limit') ?? undefined
    const tenantId = searchParams.get('tenantId') ?? undefined

    const parsed = activityLogQuerySchema.safeParse({ userId, limit })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    let where: Prisma.UserActivityLogWhereInput = parsed.data.userId
      ? { userId: parsed.data.userId }
      : {}

    if (tenantId && authUser.role === 'admin') {
      const tenantUserIds = await prisma.tenantMembership.findMany({
        where: { tenantId, isActive: true },
        select: { userId: true },
      })
      where = { ...where, userId: { in: tenantUserIds.map((m) => m.userId) } }
    }

    const logs = await prisma.userActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
      include: {
        user: { select: { userId: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error obteniendo registros de actividad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ────────────────────────────
// FINANCE
// ────────────────────────────

export async function financeGET(request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsedMeta = parseFinanceMeta(searchParams)

    if ('status' in parsedMeta) {
      return parsedMeta
    }

    const meta = parsedMeta

    const financeWhere = buildFinanceWhere(meta)

    const [ventas, ventasServicios, gastos, cuentasPorCobrar, cuentasPorPagar, tenantCount] =
      await Promise.all([
        prisma.venta.aggregate({ where: financeWhere, _sum: { total: true }, _count: true }),
        prisma.ventaServicios.aggregate({ where: financeWhere, _sum: { total: true }, _count: true }),
        prisma.gastosDE.aggregate({ where: financeWhere, _sum: { monto: true }, _count: true }),
        prisma.cuentaPorCobrar.aggregate({
          where: financeWhere,
          _sum: { montoDeuda: true, montoPagado: true },
          _count: true,
        }),
        prisma.cuentaPorPagar.aggregate({ where: financeWhere, _sum: { saldoPendiente: true }, _count: true }),
        prisma.tenant.count(),
      ])

    const summary = {
      ingresosTotales: (ventas._sum.total ?? 0) + (ventasServicios._sum.total ?? 0),
      gastosTotales: gastos._sum.monto ?? 0,
      resultadoNeto:
        (ventas._sum.total ?? 0) + (ventasServicios._sum.total ?? 0) - (gastos._sum.monto ?? 0),
      tenantsActivos: tenantCount,
    }

    const trend = [
      {
        period: meta.groupBy,
        ingresos: summary.ingresosTotales,
        gastos: summary.gastosTotales,
        resultadoNeto: summary.resultadoNeto,
      },
    ]

    const breakdown = {
      bySource: [
        { label: 'Productos', amount: ventas._sum.total ?? 0, count: ventas._count },
        { label: 'Servicios', amount: ventasServicios._sum.total ?? 0, count: ventasServicios._count },
        { label: 'Gastos', amount: gastos._sum.monto ?? 0, count: gastos._count },
      ],
      byTenant: meta.tenantId
        ? [{ label: meta.tenantId, amount: summary.ingresosTotales, count: tenantCount }]
        : [{ label: 'Global', amount: summary.ingresosTotales, count: tenantCount }],
    }

    const response: AdminFinanceReport = {
      meta,
      summary,
      accounts: {
        porCobrar: {
          total: cuentasPorCobrar._count,
          saldoPendiente:
            Number(cuentasPorCobrar._sum.montoDeuda ?? 0) - Number(cuentasPorCobrar._sum.montoPagado ?? 0),
        },
        porPagar: {
          total: cuentasPorPagar._count,
          saldoPendiente: cuentasPorPagar._sum.saldoPendiente ?? 0,
        },
      },
      trend,
      breakdown,
      tenantCount,
      revenue: {
        totalVentas: ventas._count,
        totalVentasMonto: ventas._sum.total ?? 0,
        totalVentasServicios: ventasServicios._count,
        totalServiciosMonto: ventasServicios._sum.total ?? 0,
        totalIngresos: (ventas._sum.total ?? 0) + (ventasServicios._sum.total ?? 0),
      },
      gastos: { totalGastos: gastos._count, totalMonto: gastos._sum.monto ?? 0 },
      cuentasPorCobrar: {
        total: cuentasPorCobrar._count,
        saldoPendiente:
          Number(cuentasPorCobrar._sum.montoDeuda ?? 0) - Number(cuentasPorCobrar._sum.montoPagado ?? 0),
      },
      cuentasPorPagar: {
        total: cuentasPorPagar._count,
        saldoPendiente: cuentasPorPagar._sum.saldoPendiente ?? 0,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Admin/Finance] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseFinanceMeta(searchParams: URLSearchParams): AdminFinanceMeta | Response {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const tenantId = searchParams.get('tenantId')
  const groupBy = searchParams.get('groupBy') ?? 'month'

  if (groupBy !== 'day' && groupBy !== 'week' && groupBy !== 'month') {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  if (from !== null && !isValidDate(from)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  if (to !== null && !isValidDate(to)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  if (from !== null && to !== null && new Date(from) > new Date(to)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  return {
    from: from && isValidDate(from) ? from : null,
    to: to && isValidDate(to) ? to : null,
    tenantId: tenantId || null,
    groupBy,
  }
}

function buildFinanceWhere(meta: AdminFinanceMeta): Record<string, unknown> {
  return {
    ...(meta.tenantId ? { tenantId: meta.tenantId } : {}),
    ...(meta.from || meta.to
      ? {
          createdAt: {
            ...(meta.from ? { gte: new Date(meta.from) } : {}),
            ...(meta.to ? { lte: new Date(meta.to) } : {}),
          },
        }
      : {}),
  }
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

// ────────────────────────────
// GLOBAL USERS
// ────────────────────────────

export async function globalUsersGET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request)
    if ('status' in auth) return auth as Response

    const isGlobalAdmin = isAdminRole(auth.user.role)
    const isTenantManager = auth.user.tenantId && isTenantAdminRole(auth.user.tenantRole)

    if (!isGlobalAdmin && !isTenantManager) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestedTenantId =
      isTenantManager && !isGlobalAdmin
        ? auth.user.tenantId
        : searchParams.get('tenantId') ?? undefined

    const parsed = globalUsersQuerySchema.safeParse({
      tenantId: requestedTenantId ?? undefined,
      search: searchParams.get('search') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { tenantId, search, role, isActive, page, limit, sortBy, sortOrder } = parsed.data

    const membershipWhere: Prisma.TenantMembershipWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(role ? { tenantRole: role } : {}),
      ...(typeof isActive !== 'undefined' ? { user: { isActive } } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    }

    const orderBy: Prisma.TenantMembershipOrderByWithRelationInput = {}
    if (sortBy === 'name' || sortBy === 'email') {
      orderBy.user = { [sortBy]: sortOrder }
    } else {
      orderBy.user = { createdAt: sortOrder }
    }

    let usersFromMemberships: any[] = []
    let membershipTotal = 0

    try {
      const [memberships, count] = await Promise.all([
        prisma.tenantMembership.findMany({
          where: membershipWhere,
          include: { user: true, tenant: { select: { nombre: true, slug: true } } },
          orderBy,
        }),
        prisma.tenantMembership.count({ where: membershipWhere }),
      ])

      usersFromMemberships = memberships.map((m) => ({
        ...m.user,
        tenantId: m.tenantId,
        tenantSlug: m.tenant.slug,
        tenantName: m.tenant.nombre,
        tenantRole: m.tenantRole,
        membershipId: m.membershipId,
      }))
      membershipTotal = count
    } catch (membershipError) {
      console.error('[Admin/GlobalUsers] Error consultando memberships:', membershipError)
    }

    let usersFromPending: any[] = []

    try {
      const pendingUserWhere: Prisma.UserWhereInput = {
        onboardingStatus: 'awaiting_global_approval',
        tenantMemberships: { none: {} },
        ...(typeof isActive !== 'undefined' ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }

      const pendingUsers = await prisma.user.findMany({
        where: pendingUserWhere,
        orderBy:
          sortBy === 'name' || sortBy === 'email'
            ? { [sortBy]: sortOrder }
            : { createdAt: 'desc' },
      })

      if (Array.isArray(pendingUsers)) {
        usersFromPending = pendingUsers.map((u) => ({
          ...u,
          tenantId: null,
          tenantSlug: null,
          tenantName: null,
          tenantRole: null,
          membershipId: null,
        }))
      }
    } catch (pendingError) {
      console.error('[Admin/GlobalUsers] Error consultando usuarios pendientes:', pendingError)
    }

    const allUsers = [...usersFromMemberships, ...usersFromPending]
    const total = membershipTotal + usersFromPending.length
    const startIndex = (page - 1) * limit
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limit)

    return NextResponse.json({ users: paginatedUsers, total, page, pages: Math.ceil(total / limit), limit })
  } catch (error) {
    console.error('Error obteniendo usuarios globales:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function globalUsersMetricsGET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request)
    if ('status' in auth) return auth as Response

    if (!isAdminRole(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const months = searchParams.get('months') ?? undefined
    const tenantId = searchParams.get('tenantId') ?? undefined

    const parsed = userMetricsQuerySchema.safeParse({ months })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const metrics = await getUserMetrics(prisma, parsed.data.months, tenantId)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error obteniendo métricas globales de usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

interface ApproveBody {
  tenantName?: string
  planId?: string
  licenseDurationDays?: number
}

export async function globalUsersApprovePOST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateUser(request)
    if ('status' in auth) return auth as Response

    if (!isAdminRole(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: userId } = await context.params

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 })
    }

    const body = (await request.json()) as ApproveBody

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, onboardingStatus: true, onboardingType: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.onboardingStatus !== 'awaiting_global_approval') {
      return NextResponse.json(
        { error: 'El usuario no está esperando aprobación global' },
        { status: 400 },
      )
    }

    const tenantName = body.tenantName?.trim() || 'Nueva Empresa'
    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const existingSlug = await prisma.tenant.findUnique({
      where: { slug },
      select: { tenantId: true },
    })

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { nombre: tenantName, slug: finalSlug } })

      await tx.moneda.upsert({
        where: { codigo: 'CUP' },
        update: { esPrincipal: true, isActive: true },
        create: { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
      })

      const membership = await tx.tenantMembership.create({
        data: { tenantId: tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
      })

      const updatedUser = await tx.user.update({
        where: { userId: user.userId },
        data: { role: 'manager', isActive: true, onboardingStatus: 'completed', activatedAt: new Date() },
      })

      let license = null
      if (body.planId) {
        const plan = await tx.plan.findUnique({ where: { planId: body.planId } })
        if (plan) {
          const durationDays =
            typeof body.licenseDurationDays === 'number' && body.licenseDurationDays > 0
              ? body.licenseDurationDays
              : plan.duracionDias
          const expiracion = new Date()
          expiracion.setDate(expiracion.getDate() + durationDays)

          license = await tx.tenantLicense.create({
            data: {
              tenantId: tenant.tenantId,
              planId: plan.planId,
              expiracion,
              maxUsuarios: plan.maxUsuarios,
              maxAlmacenes: plan.maxAlmacenes,
              maxProductos: plan.maxProductos,
            },
          })
        }
      }

      return { tenant, membership, user: updatedUser, license }
    })

    return NextResponse.json({
      success: true,
      action: 'approved',
      tenant: {
        tenantId: result.tenant.tenantId,
        nombre: result.tenant.nombre,
        slug: result.tenant.slug,
      },
      membershipId: result.membership.membershipId,
      license: result.license
        ? {
            tenantLicenseId: result.license.tenantLicenseId,
            planId: result.license.planId,
            expiracion: result.license.expiracion,
          }
        : null,
    })
  } catch (error) {
    console.error('Error aprobando usuario global:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ────────────────────────────
// LICENCIAS (Admin)
// ────────────────────────────

export async function adminLicenciasGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = licenciaQuerySchema.safeParse({
      planId: searchParams.get('planId') ?? undefined,
      activa: searchParams.get('activa') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { planId, activa, search, page, limit, sortBy, sortOrder } = parsed.data

    const where: Prisma.LicenciaWhereInput = {
      ...(planId ? { planId } : {}),
      ...(activa !== undefined ? { activa: activa === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { clave: { contains: search, mode: 'insensitive' as const } },
              {
                usuario: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    }

    const orderBy: Prisma.LicenciaOrderByWithRelationInput = {}
    if (sortBy === 'expiracion' || sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [licencias, total] = await Promise.all([
      prisma.licencia.findMany({
        where,
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.licencia.count({ where }),
    ])

    return NextResponse.json({ licencias, total, page, pages: Math.ceil(total / limit), limit })
  } catch (error) {
    console.error('Error fetching licencias:', error)
    return NextResponse.json({ error: 'Error obteniendo licencias' }, { status: 500 })
  }
}

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const parts: string[] = []
  for (let s = 0; s < 4; s++) {
    let segmento = ''
    for (let i = 0; i < 5; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    parts.push(segmento)
  }
  return parts.join('-')
}

export async function adminLicenciasPOST(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = licenciaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { clave, usuarioId, planId, duracionDias } = parsed.data

    const plan = await prisma.plan.findUnique({ where: { planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const usuario = await prisma.user.findUnique({ where: { userId: usuarioId } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const expiracion = new Date()
    expiracion.setDate(expiracion.getDate() + (duracionDias || plan.duracionDias))

    const licenseKey =
      typeof clave === 'string' && clave.trim().length > 0 ? clave.trim() : generarClave()

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
        data: { expiresAt: expiracion, isActive: true },
      })

      const existingMembership = await tx.tenantMembership.findFirst({
        where: { userId: usuarioId, isActive: true },
      })

      if (!existingMembership) {
        const slugBase = (usuario.name || 'empresa')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
        const slug = `${slugBase}-${Date.now().toString(36)}`

        const tenant = await tx.tenant.create({ data: { nombre: usuario.name || 'Nueva Empresa', slug } })

        await tx.tenantMembership.create({
          data: { tenantId: tenant.tenantId, userId: usuarioId, tenantRole: 'manager', isActive: true },
        })

        await tx.tenantLicense.create({
          data: {
            tenantId: tenant.tenantId,
            planId,
            expiracion,
            maxUsuarios: plan.maxUsuarios,
            maxAlmacenes: plan.maxAlmacenes,
            maxProductos: plan.maxProductos,
          },
        })
      } else {
        await tx.tenantLicense.create({
          data: {
            tenantId: existingMembership.tenantId,
            planId,
            expiracion,
            maxUsuarios: plan.maxUsuarios,
            maxAlmacenes: plan.maxAlmacenes,
            maxProductos: plan.maxProductos,
          },
        })
      }

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
            tipo: 'manual',
          }),
        },
      })

      return nuevaLicencia
    })

    return NextResponse.json(licencia, { status: 201 })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'La clave de licencia ya existe' }, { status: 409 })
    }
    console.error('Error creando licencia:', error)
    return NextResponse.json({ error: 'Error creando licencia' }, { status: 500 })
  }
}

export async function adminLicenciasGetById(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

export async function adminLicenciasUpdate(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const parsed = updateLicenciaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { activa, expiracion, usuarioId } = parsed.data

  const licenciaActual = await prisma.licencia.findUnique({
    where: { licenciaId: id },
    select: { usuarioId: true, expiracion: true, activa: true },
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
      if (targetUserId) {
        await tx.user.update({
          where: { userId: targetUserId },
          data: { expiresAt: nuevaExpiracion },
        })
      }
    }

    const accion =
      activa === false
        ? 'REVOCACION'
        : activa === true
          ? 'ACTIVACION'
          : expiracion
            ? 'EXTENSION'
            : 'MODIFICACION'

    await tx.licenciaAudit.create({
      data: {
        licenciaId: id,
        accion,
        realizadoPor: user.userId,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        detalles: JSON.stringify({
          cambios: { activa, expiracion, usuarioId },
          estadoAnterior: { activa: licenciaActual.activa, expiracion: licenciaActual.expiracion },
        }),
      },
    })

    return licUpdated
  })

  return NextResponse.json(licencia)
}

export async function adminLicenciasDelete(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params

  const licencia = await prisma.licencia.findUnique({
    where: { licenciaId: id },
    select: { usuarioId: true },
  })

  if (!licencia) {
    return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.licenciaAudit.create({
      data: {
        licenciaId: id,
        accion: 'ELIMINACION',
        realizadoPor: user.userId,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        detalles: JSON.stringify({ usuarioId: licencia.usuarioId }),
      },
    })

    await tx.licencia.delete({ where: { licenciaId: id } })
  })

  return NextResponse.json({ message: 'Licencia eliminada' })
}

export async function adminLicenciasAuditoriaGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const licenciaId = searchParams.get('licenciaId') ?? undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))

    const where = licenciaId ? { licenciaId } : {}

    const [audits, total] = await Promise.all([
      prisma.licenciaAudit.findMany({
        where,
        include: { licencia: { select: { clave: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.licenciaAudit.count({ where }),
    ])

    return NextResponse.json({ audits, total, page, pages: Math.ceil(total / limit), limit })
  } catch (error) {
    console.error('Error fetching auditoría:', error)
    return NextResponse.json({ error: 'Error obteniendo auditoría' }, { status: 500 })
  }
}

export async function adminLicenciasGenerarPOST(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = generarLicenciasSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { planId, usuarioId, cantidad, duracionDias, idempotencyKey } = parsed.data

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const usuario = await prisma.user.findUnique({ where: { userId: usuarioId } })
  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const dias = typeof duracionDias === 'number' && duracionDias > 0 ? duracionDias : plan.duracionDias
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
          const existente = await tx.licencia.findUnique({ where: { clave } })
          if (!existente) break
          clave = generarClave()
        }

        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + dias)

        const licencia = await tx.licencia.create({
          data: { clave, planId, usuarioId, expiracion, activa: true },
          select: { clave: true, expiracion: true },
        })

        licenseCreationCounter.inc({ plan: plan.nombre, origen: 'admin' })
        resultados.push(licencia)
      }

      await tx.licenciaAudit.create({
        data: {
          licenciaId: null,
          accion: 'GENERACION_BATCH',
          realizadoPor: user.userId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          detalles: JSON.stringify({ cantidad, plan: plan.nombre, dias, planId, usuarioId, usuario: usuario.name }),
        },
      })
    })
  } catch (e) {
    console.error('Error generando licencias:', e)
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

export async function adminLicenciasInitPOST(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const planes = await prisma.plan.findMany()
  if (planes.length > 0) {
    return NextResponse.json({ message: 'Ya existen planes', planes })
  }

  await prisma.plan.createMany({
    data: [
      { nombre: 'Free', descripcion: 'Plan gratuito para prueba', precio: 0, duracionDias: 30, maxUsuarios: 1, maxAlmacenes: 1, maxProductos: 50 },
      { nombre: 'Básico', descripcion: 'Para pequeños negocios', precio: 9.99, duracionDias: 30, maxUsuarios: 3, maxAlmacenes: 2, maxProductos: 500 },
      { nombre: 'Profesional', descripcion: 'Para negocios medianos', precio: 29.99, duracionDias: 30, maxUsuarios: 10, maxAlmacenes: 5, maxProductos: 2000 },
      { nombre: 'Enterprise', descripcion: 'Sin límites', precio: 99.99, duracionDias: 30, maxUsuarios: 100, maxAlmacenes: 20, maxProductos: 100000 },
    ],
  })

  const planesCreados = await prisma.plan.findMany()

  return NextResponse.json({ message: 'Planes inicializados', planes: planesCreados })
}

// ────────────────────────────
// MEMBERSHIPS
// ────────────────────────────

export async function membershipsPendingGET(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (!user.tenantId) {
      return NextResponse.json([])
    }

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId: user.tenantId, isActive: false },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            onboardingType: true,
            onboardingStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(memberships)
  } catch (error) {
    console.error('Error listando membresías pendientes:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function membershipsUpdate(request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser) {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Se requiere una membresía de empresa activa para gestionar membresías' },
        { status: 403 },
      )
    }

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: membershipId } = await context.params

    if (!membershipId || typeof membershipId !== 'string') {
      return NextResponse.json({ error: 'ID de membresía inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { action, tenantRole: requestedRole } = body as { action: string; tenantRole?: string }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida. Usá approve o reject.' }, { status: 400 })
    }

    const membership = await prisma.tenantMembership.findUnique({
      where: { membershipId },
      select: { membershipId: true, tenantId: true, userId: true, isActive: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membresía no encontrada' }, { status: 404 })
    }

    if (membership.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'La membresía no pertenece a tu empresa' }, { status: 403 })
    }

    if (action === 'reject') {
      await prisma.tenantMembership.delete({ where: { membershipId } })
      await prisma.user.update({
        where: { userId: membership.userId },
        data: { onboardingStatus: 'selecting_tenant' },
      })
      return NextResponse.json({ success: true, action: 'rejected' })
    }

    const role = normalizeTenantRole(requestedRole) ?? 'dependiente'

    await prisma.tenantMembership.update({
      where: { membershipId },
      data: { isActive: true, tenantRole: role },
    })

    await prisma.user.update({
      where: { userId: membership.userId },
      data: { role: 'dependiente', isActive: true, onboardingStatus: 'completed', activatedAt: new Date() },
    })

    return NextResponse.json({ success: true, action: 'approved', tenantRole: role })
  } catch (error) {
    console.error('Error procesando membresía:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ────────────────────────────
// MIGRATE: CUENTAS POR PAGAR
// ────────────────────────────

export async function migrateCuentasPorPagarPOST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload = rawBody.trim().length > 0 ? JSON.parse(rawBody) : {}
    const bodyValidation = migrateCuentasPorPagarBodySchema.safeParse(payload)

    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: bodyValidation.error.flatten() },
        { status: 400 },
      )
    }

    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const user = authResult.user

    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar migraciones' }, { status: 403 })
    }

    const cuentasSinGasto = await prisma.cuentaPorPagar.findMany({
      where: { tipo: 'compra', gastoCompraId: null },
      include: { proveedor: true },
    })

    if (cuentasSinGasto.length === 0) {
      return NextResponse.json({
        message: 'No hay cuentas para migrar. Todo está actualizado.',
        procesadas: 0, errores: 0, detalles: [],
      })
    }

    interface MigrationDetail {
      cuentaPorPagarId: string
      numeroFactura: string
      estado: 'OK' | 'ERROR'
      gastoCompraId?: string
      error?: string
    }

    const resultados: MigrationDetail[] = []
    let procesadas = 0
    let errores = 0

    for (const cuenta of cuentasSinGasto) {
      try {
        const compraProducto = await prisma.compraProducto.findFirst({
          where: { cuentaPorPagarId: cuenta.cuentaPorPagarId },
          include: { producto: true },
        })

        if (!compraProducto) {
          resultados.push({
            cuentaPorPagarId: cuenta.cuentaPorPagarId,
            numeroFactura: cuenta.numeroFactura,
            estado: 'ERROR',
            error: 'No se encontró CompraProducto asociada',
          })
          errores++
          continue
        }

        const periodo = cuenta.createdAt
          ? `${cuenta.createdAt.getFullYear()}-${String(cuenta.createdAt.getMonth() + 1).padStart(2, '0')}`
          : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

        const gastoCompra = await prisma.$transaction(async (tx) => {
          const createdGasto = await tx.gastoCompra.create({
            data: {
              productoId: compraProducto.productoId,
              vendorId: cuenta.proveedorId || compraProducto.proveedorId,
              numeroFactura: cuenta.numeroFactura,
              cantidad: compraProducto.cantidad,
              precioUnitario: compraProducto.precioUnitario,
              total: Number(cuenta.montoDeuda),
              fechaCompra: cuenta.fechaEmision || cuenta.createdAt || new Date(),
              descripcion: compraProducto.descripcion || `Compra - ${compraProducto.producto?.nombre || 'Producto'}`,
              periodo,
              tenantId: cuenta.tenantId,
            },
          })

          await tx.cuentaPorPagar.update({
            where: { cuentaPorPagarId: cuenta.cuentaPorPagarId },
            data: { gastoCompraId: createdGasto.gastoCompraId },
          })

          await tx.compraProducto.update({
            where: { compraProductoId: compraProducto.compraProductoId },
            data: { gastoCompraId: createdGasto.gastoCompraId },
          })

          return createdGasto
        })

        resultados.push({
          cuentaPorPagarId: cuenta.cuentaPorPagarId,
          numeroFactura: cuenta.numeroFactura,
          gastoCompraId: gastoCompra.gastoCompraId,
          estado: 'OK',
        })
        procesadas++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido'
        console.error(`Error al procesar cuenta ${cuenta.cuentaPorPagarId}:`, error)
        resultados.push({
          cuentaPorPagarId: cuenta.cuentaPorPagarId,
          numeroFactura: cuenta.numeroFactura,
          estado: 'ERROR',
          error: message,
        })
        errores++
      }
    }

    return NextResponse.json({
      message: `Migración completada. ${procesadas} cuentas procesadas, ${errores} errores.`,
      procesadas, errores, total: cuentasSinGasto.length, detalles: resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error en migración:', error)
    return NextResponse.json({ error: 'Error durante la migración', message }, { status: 500 })
  }
}

export async function migrateCuentasPorPagarGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const user = authResult.user

    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden ver el estado de migraciones' },
        { status: 403 },
      )
    }

    const cuentasPendientes = await prisma.cuentaPorPagar.count({
      where: { tipo: 'compra', gastoCompraId: null },
    })

    const cuentas = await prisma.cuentaPorPagar.findMany({
      where: { tipo: 'compra', gastoCompraId: null },
      select: {
        cuentaPorPagarId: true,
        numeroFactura: true,
        proveedorNombre: true,
        montoDeuda: true,
        estado: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      pendientes: cuentasPendientes,
      cuentas: cuentas.map((cuenta) => ({ ...cuenta, montoDeuda: Number(cuenta.montoDeuda) })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error al obtener estado de migración:', error)
    return NextResponse.json({ error: 'Error al obtener estado', message }, { status: 500 })
  }
}

// ────────────────────────────
// PLANES (Admin)
// ────────────────────────────

export async function adminPlanesGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = planQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { page, limit, search } = parsed.data
    const where: Prisma.PlanWhereInput = search
      ? { OR: [{ nombre: { contains: search, mode: 'insensitive' as const } }, { descripcion: { contains: search, mode: 'insensitive' as const } }] }
      : {}

    const [planes, total] = await Promise.all([
      prisma.plan.findMany({ where, orderBy: { precio: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.plan.count({ where }),
    ])

    const planesConConteo = await Promise.all(
      planes.map(async (plan) => {
        const licenciasCount = await prisma.licencia.count({ where: { planId: plan.planId } })
        return { ...plan, licenciasCount }
      }),
    )

    return NextResponse.json({ planes: planesConConteo, total, page, pages: Math.ceil(total / limit), limit })
  } catch (error) {
    console.error('Error fetching planes:', error)
    return NextResponse.json({ error: 'Error obteniendo planes' }, { status: 500 })
  }
}

export async function adminPlanesPOST(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = planSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = parsed.data

    const plan = await prisma.plan.create({
      data: { nombre, descripcion, precio: precio || 0, duracionDias, maxUsuarios: maxUsuarios || 1, maxAlmacenes: maxAlmacenes || 1, maxProductos: maxProductos || 100 },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creando plan:', error)
    return NextResponse.json({ error: 'Error creando plan' }, { status: 500 })
  }
}

export async function adminPlanesGetById(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const plan = await prisma.plan.findUnique({ where: { planId: id } })

  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  return NextResponse.json(plan)
}

export async function adminPlanesUpdate(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const parsed = updatePlanSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = parsed.data

  const plan = await prisma.plan.update({
    where: { planId: id },
    data: {
      ...(nombre && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(precio !== undefined && { precio }),
      ...(duracionDias && { duracionDias }),
      ...(maxUsuarios && { maxUsuarios }),
      ...(maxAlmacenes && { maxAlmacenes }),
      ...(maxProductos && { maxProductos }),
    },
  })

  return NextResponse.json(plan)
}

export async function adminPlanesDelete(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params

  const licenciasCount = await prisma.licencia.count({ where: { planId: id } })

  if (licenciasCount > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un plan con licencias asociadas', licenciasCount },
      { status: 400 },
    )
  }

  await prisma.plan.delete({ where: { planId: id } })

  return NextResponse.json({ message: 'Plan eliminado' })
}

// ────────────────────────────
// SESSIONS
// ────────────────────────────

export async function sessionsGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') ?? undefined
    const tenantId = searchParams.get('tenantId') ?? undefined

    let where: Prisma.UserSessionWhereInput = userId ? { userId } : {}

    if (tenantId && authUser.role === 'admin') {
      const tenantUserIds = await prisma.tenantMembership.findMany({
        where: { tenantId, isActive: true },
        select: { userId: true },
      })
      where = { ...where, userId: { in: tenantUserIds.map((m) => m.userId) } }
    }

    const sessions = await prisma.userSession.findMany({
      where,
      orderBy: { lastActive: 'desc' },
      include: { user: { select: { userId: true, name: true, email: true, role: true } } },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error obteniendo sesiones:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function sessionsDELETE(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = deleteSessionQuerySchema.safeParse({
      sessionId: searchParams.get('sessionId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    await prisma.userSession.update({
      where: { id: parsed.data.sessionId },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Sesión cerrada correctamente' })
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ────────────────────────────
// SYSTEM
// ────────────────────────────

export async function systemGET(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 })
    }

    const [totalUsers, totalTenants, activeSessions, usersByRole, expiringLicenses, activeLicenses, totalLicenses] =
      await Promise.all([
        prisma.user.count(),
        prisma.tenant.count(),
        prisma.userSession.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
        prisma.user.groupBy({ by: ['role'], _count: true }),
        prisma.tenantLicense.count({
          where: {
            activa: true,
            expiracion: { gt: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.tenantLicense.count({ where: { activa: true, expiracion: { gt: new Date() } } }),
        prisma.tenantLicense.count(),
      ])

    return NextResponse.json({
      users: { total: totalUsers, byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })) },
      tenants: { total: totalTenants },
      sessions: { active: activeSessions },
      licenses: { total: totalLicenses, active: activeLicenses, expiringSoon: expiringLicenses },
    })
  } catch (error) {
    console.error('[Admin/System] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ────────────────────────────
// TENANT LICENSE
// ────────────────────────────

export async function tenantLicenseGET(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (!user.tenantId) {
      return NextResponse.json({
        license: null,
        limits: { maxUsuarios: 0, maxAlmacenes: 0, maxProductos: 0 },
        consumption: { usuarios: 0, almacenes: 0, productos: 0 },
        tenantId: null,
        tenantRole: null,
      })
    }

    const license = await prisma.tenantLicense.findFirst({
      where: { tenantId: user.tenantId, activa: true },
      orderBy: { inicio: 'desc' },
      include: { plan: true },
    })

    const [userCount, almacenCount, productoCount] = await Promise.all([
      prisma.tenantMembership.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.almacen.count({ where: { tenantId: user.tenantId } }),
      prisma.producto.count({ where: { tenantId: user.tenantId } }),
    ])

    return NextResponse.json({
      license: license
        ? {
            tenantLicenseId: license.tenantLicenseId,
            activa: license.activa,
            inicio: license.inicio,
            expiracion: license.expiracion,
            plan: license.plan ? { planId: license.plan.planId, nombre: license.plan.nombre } : null,
          }
        : null,
      limits: {
        maxUsuarios: license?.maxUsuarios ?? 0,
        maxAlmacenes: license?.maxAlmacenes ?? 0,
        maxProductos: license?.maxProductos ?? 0,
      },
      consumption: { usuarios: userCount, almacenes: almacenCount, productos: productoCount },
      tenantId: user.tenantId,
      tenantRole: user.tenantRole,
    })
  } catch (error) {
    console.error('[TenantLicense] Error:', error)
    const message = error instanceof Error ? error.message : 'Error obteniendo licencia del tenant'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ────────────────────────────
// TENANTS
// ────────────────────────────

export async function tenantsGET(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 })
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: true, productos: true, almacenes: true, ventas: true } },
        licencias: {
          where: { activa: true, expiracion: { gt: new Date() } },
          orderBy: { inicio: 'desc' },
          take: 1,
          include: { plan: { select: { nombre: true } } },
        },
        memberships: {
          where: { isActive: true },
          select: { membershipId: true },
        },
      },
    })

    const result = tenants.map((tenant) => {
      const activeLicense = tenant.licencias[0] ?? null
      return {
        tenantId: tenant.tenantId,
        nombre: tenant.nombre,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        totalUsers: tenant._count.memberships,
        activeUsers: tenant.memberships.length,
        totalProductos: tenant._count.productos,
        totalAlmacenes: tenant._count.almacenes,
        totalVentas: tenant._count.ventas,
        plan: activeLicense?.plan?.nombre ?? 'Sin plan',
        planId: activeLicense?.planId ?? null,
        licenseActive: activeLicense !== null,
        licenseExpiresAt: activeLicense?.expiracion ?? null,
        consumption: {
          usuarios: tenant.memberships.length,
          almacenes: tenant._count.almacenes,
          productos: tenant._count.productos,
        },
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Admin/Tenants] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function tenantsGetById(_request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 })
    }

    const { id } = await context.params

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId: id },
      include: {
        _count: { select: { memberships: true, productos: true, almacenes: true, ventas: true, clientes: true, vendors: true, empleados: true } },
        licencias: {
          orderBy: { inicio: 'desc' },
          take: 1,
          include: { plan: { select: { nombre: true, descripcion: true, precio: true } } },
        },
        memberships: {
          where: { isActive: true },
          include: {
            user: { select: { userId: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        empresa: { select: { nombre: true, propietario: true, email: true, telefono: true } },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
    }

    const activeLicense = tenant.licencias[0] ?? null

    return NextResponse.json({
      tenantId: tenant.tenantId,
      nombre: tenant.nombre,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      empresa: tenant.empresa,
      stats: {
        totalUsers: tenant._count.memberships,
        activeUsers: tenant.memberships.length,
        totalProductos: tenant._count.productos,
        totalAlmacenes: tenant._count.almacenes,
        totalVentas: tenant._count.ventas,
        totalClientes: tenant._count.clientes,
        totalProveedores: tenant._count.vendors,
        totalEmpleados: tenant._count.empleados,
      },
      license: activeLicense
        ? {
            plan: activeLicense.plan?.nombre ?? null,
            planPrecio: activeLicense.plan?.precio ?? null,
            activa: activeLicense.activa,
            inicio: activeLicense.inicio,
            expiracion: activeLicense.expiracion,
            maxUsuarios: activeLicense.maxUsuarios,
            maxAlmacenes: activeLicense.maxAlmacenes,
            maxProductos: activeLicense.maxProductos,
          }
        : null,
      users: tenant.memberships.map((m: { user: { userId: string; name: string | null; email: string; role: string; isActive: boolean; createdAt: Date }; tenantRole: string }) => ({
        userId: m.user.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        tenantRole: m.tenantRole,
        isActive: m.user.isActive,
        createdAt: m.user.createdAt,
      })),
    })
  } catch (error) {
    console.error('[Admin/Tenant Detail] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ────────────────────────────
// USERS (Tenant-scoped)
// ────────────────────────────

export async function usersGET(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (!user.tenantId) {
      return NextResponse.json([])
    }

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId: user.tenantId },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
            lastModifiedBy: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const users = memberships.map((m) => ({ ...m.user, tenantRole: m.tenantRole, membershipId: m.membershipId }))
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error obteniendo users del tenant:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function usersPOST(request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Se requiere una membresía de empresa activa para crear usuarios' },
        { status: 403 },
      )
    }

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parseResult = createUserBodySchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parseResult.error.flatten() },
        { status: 400 },
      )
    }

    const { name, email, password, role, tenantRole, daysToExpire } = parseResult.data

    const currentCount = await prisma.tenantMembership.count({ where: { tenantId: user.tenantId } })
    await validateTenantLimit(user.tenantId, 'maxUsuarios', currentCount)

    const existingUser = await prisma.user.findUnique({ where: { email } })
    let targetUser = existingUser

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(password, 12)
      const now = new Date()
      const expiresAt = daysToExpire
        ? new Date(now.getTime() + daysToExpire * 24 * 60 * 60 * 1000)
        : null

      targetUser = await prisma.user.create({
        data: {
          name, email, password: hashedPassword, role,
          isActive: false, activatedAt: now, expiresAt,
          lastModifiedBy: user.userId,
          loginAttempts: 0, lockedUntil: null, lastFailedLogin: null,
        },
      })
    } else {
      const existingMembership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: user.tenantId, userId: existingUser.userId } },
      })
      if (existingMembership) {
        return NextResponse.json({ error: 'El usuario ya pertenece a esta empresa' }, { status: 409 })
      }
    }

    const effectiveTenantRole = tenantRole ?? platformRoleToTenantRole(role as any)
    await prisma.tenantMembership.create({
      data: {
        tenantId: user.tenantId,
        userId: targetUser!.userId,
        tenantRole: effectiveTenantRole,
        isActive: true,
      },
    })

    await prisma.userActivityLog.create({
      data: {
        userId: targetUser!.userId,
        action: existingUser ? 'assign_tenant' : 'create_user',
        details: JSON.stringify({ role, tenantRole: effectiveTenantRole, email, tenantId: user.tenantId }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: user.userId,
      },
    })

    if (!existingUser) {
      await sendNewUserNotification(targetUser!.name, targetUser!.email, targetUser!.role, user.email ?? '')
    }

    const { password: _, ...safeUser } = targetUser!
    return NextResponse.json({ ...safeUser, tenantRole })
  } catch (error) {
    console.error('Error creando usuario en tenant:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function usersGetById(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const paramParse = userIdParamSchema.safeParse(await context.params)
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 })
    }

    const { id } = paramParse.data

    const membership = await prisma.tenantMembership.findFirst({ where: { userId: id, tenantId } })
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, name: true, email: true, role: true, isActive: true, activatedAt: true, expiresAt: true, createdAt: true, updatedAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error obteniendo usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersUpdate(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const authUser = authResult.user as AuthenticatedUser
    const isGlobalAdmin = isAdminRole(authUser.role)

    if (!isGlobalAdmin && (!authUser.tenantId || !isTenantAdminRole(authUser.tenantRole))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const paramParse = userIdParamSchema.safeParse(await context.params)
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 })
    }

    const body = await request.json()
    const bodyParse = updateUserBodySchema.safeParse(body)
    if (!bodyParse.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: bodyParse.error.flatten() },
        { status: 400 },
      )
    }

    const { id } = paramParse.data

    if (!isGlobalAdmin) {
      const membership = await prisma.tenantMembership.findFirst({
        where: { userId: id, tenantId: authUser.tenantId },
      })
      if (!membership) {
        return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
      }
    }

    const { name, email, password, role, tenantRole, isActive, daysToExpire } = bodyParse.data

    const existingUser = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, isActive: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    type UpdateUserData = {
      name?: string
      email?: string
      password?: string
      role?: string
      isActive?: boolean
      activatedAt?: Date
      expiresAt?: Date
    }

    const updateData: UpdateUserData = { name, email, role, isActive }

    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    if (isActive === true && existingUser.isActive === false) {
      updateData.activatedAt = new Date()
    }

    if (daysToExpire && isActive !== false) {
      updateData.expiresAt = new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000)
    }

    const updatedUser = await prisma.user.update({
      where: { userId: id },
      data: { ...updateData, lastModifiedBy: authUser.userId },
      select: {
        userId: true, name: true, email: true, role: true, isActive: true,
        activatedAt: true, expiresAt: true, createdAt: true, updatedAt: true, lastModifiedBy: true,
      },
    })

    if (tenantRole) {
      await prisma.tenantMembership.updateMany({ where: { userId: id }, data: { tenantRole } })
    }

    await prisma.userActivityLog.create({
      data: {
        userId: id,
        action: 'update_user',
        details: JSON.stringify({ fields: Object.keys(updateData), tenantRole }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error actualizando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersDelete(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const paramParse = userIdParamSchema.safeParse(await context.params)
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 })
    }

    const { id } = paramParse.data

    const membership = await prisma.tenantMembership.findFirst({ where: { userId: id, tenantId } })
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    const userToDelete = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, name: true, email: true, role: true },
    })

    await prisma.user.delete({ where: { userId: id } })

    if (userToDelete) {
      await prisma.userActivityLog.create({
        data: {
          userId: id,
          action: 'delete_user',
          details: JSON.stringify(userToDelete),
          ipAddress: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
          performedBy: authUser.userId,
        },
      })
    }

    return NextResponse.json({ message: 'Usuario eliminado correctamente' })
  } catch (error) {
    console.error('Error eliminando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersLoginHistoryGET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as NextResponse
    const auth_user = authResult.user
    const tenantId = auth_user.tenantId
    if (!tenantId || !isTenantAdminRole(auth_user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await context.params

    const membership = await prisma.tenantMembership.findFirst({ where: { tenantId, userId: id, isActive: true } })
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, name: true, email: true, loginAttempts: true, lockedUntil: true, lastFailedLogin: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const logs = await prisma.userActivityLog.findMany({
      where: { userId: id, action: { in: ['login_failed', 'unlock_user'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const failedAttempts = await prisma.userActivityLog.findMany({
      where: { userId: id, action: 'login_failed' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ user, logs, failedAttempts, totalFailedAttempts: failedAttempts.length })
  } catch (error) {
    console.error('Error obteniendo historial de intentos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersExpiringSoonPOST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parsedBody = expiringUsersBodySchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsedBody.error.flatten() },
        { status: 400 },
      )
    }

    const { days } = parsedBody.data
    const now = new Date()

    const expiringSoon = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      select: { user: { select: { userId: true, name: true, email: true, expiresAt: true, role: true, isActive: true } } },
    })

    const usersExpiringSoon = expiringSoon
      .map((m) => m.user)
      .filter((user) => {
        if (!user.expiresAt) return false
        const daysUntilExpiry = Math.ceil(
          (new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
        return daysUntilExpiry > 0 && daysUntilExpiry <= days
      })

    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        tenantMemberships: {
          some: { tenantId, isActive: true, tenantRole: { in: ['admin', 'manager'] } },
        },
      },
      select: { userId: true, name: true },
    })

    const notificationsCreated = []

    for (const user of usersExpiringSoon) {
      if (!user.expiresAt) continue

      const daysUntilExpiry = Math.ceil(
        (new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )

      for (const admin of admins) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: admin.userId,
            title: { contains: user.name ?? '' },
            message: { contains: 'expirará pronto' },
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        })

        if (!existingNotification) {
          const notification = await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: 'Usuario expirará pronto',
              message: `El usuario ${user.name} (${user.email}) expirará en ${daysUntilExpiry} días (${new Date(user.expiresAt).toLocaleDateString('es-ES')}).`,
              type: 'warning',
              prioridad: 'media',
            },
          })
          notificationsCreated.push(notification)
        }
      }
    }

    return NextResponse.json({
      message: 'Notificaciones creadas exitosamente',
      usersExpiringSoon: usersExpiringSoon.length,
      notificationsCreated: notificationsCreated.length,
      users: usersExpiringSoon.map((u) => ({
        userId: u.userId,
        name: u.name,
        email: u.email,
        expiresAt: u.expiresAt,
        daysUntilExpiry: u.expiresAt
          ? Math.ceil((new Date(u.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
    })
  } catch (error) {
    console.error('Error creando notificaciones de expiración:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersExpiringSoonGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsedQuery = expiringUsersQuerySchema.safeParse({
      days: searchParams.get('days') ?? undefined,
    })

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsedQuery.error.flatten() },
        { status: 400 },
      )
    }

    const { days } = parsedQuery.data
    const now = new Date()

    const expiringSoon = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      select: {
        user: {
          select: { userId: true, name: true, email: true, expiresAt: true, role: true, createdAt: true, isActive: true },
        },
      },
    })

    const usersWithDaysUntilExpiry = (expiringSoon.map((m) => m.user) as any[])
      .map((user) => ({
        ...user,
        daysUntilExpiry: user.expiresAt
          ? Math.ceil((new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }))
      .filter((user) => user.daysUntilExpiry > 0)

    return NextResponse.json({ users: usersWithDaysUntilExpiry, total: usersWithDaysUntilExpiry.length })
  } catch (error) {
    console.error('Error obteniendo usuarios que expiran pronto:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersExportGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          select: {
            userId: true, name: true, email: true, role: true, isActive: true,
            activatedAt: true, expiresAt: true, createdAt: true, updatedAt: true,
            lastModifiedBy: true, loginAttempts: true, lockedUntil: true, lastFailedLogin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const users = memberships.map((m) => m.user)

    if (format === 'csv') {
      const headers = [
        'User ID', 'Nombre', 'Email', 'Rol', 'Activo', 'Fecha Activación',
        'Fecha Expiración', 'Fecha Creación', 'Última Modificación',
        'Intentos Login', 'Bloqueado Hasta', 'Último Fallido',
      ]

      const rows = users.map((user) => [
        user.userId, user.name, user.email, user.role, user.isActive ? 'Sí' : 'No',
        user.activatedAt ? new Date(user.activatedAt).toISOString() : '',
        user.expiresAt ? new Date(user.expiresAt).toISOString() : '',
        new Date(user.createdAt).toISOString(),
        user.lastModifiedBy || '', user.loginAttempts.toString(),
        user.lockedUntil ? new Date(user.lockedUntil).toISOString() : '',
        user.lastFailedLogin ? new Date(user.lastFailedLogin).toISOString() : '',
      ])

      const csvRows = buildCsv(headers, rows)

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usuarios_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error exportando usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersLockPOST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = lockUserBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { userId, reason } = parsed.data

    const membership = await prisma.tenantMembership.findFirst({ where: { tenantId, userId, isActive: true } })
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, role: true, lockedUntil: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000)

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { lockedUntil, isActive: false },
      select: { userId: true, name: true, email: true, role: true, isActive: true, lockedUntil: true },
    })

    await prisma.userActivityLog.create({
      data: {
        userId,
        action: 'manual_lock',
        details: JSON.stringify({
          lockedBy: authUser.userId,
          reason: reason || 'Bloqueo manual por administrador',
          lockedUntil: lockedUntil.toISOString(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    })

    await prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    })

    return NextResponse.json({ user: updatedUser, message: 'Usuario bloqueado correctamente' })
  } catch (error) {
    console.error('Error bloqueando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersUnlockPOST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user as AuthenticatedUser
    const tenantId = authUser.tenantId
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = unlockUserBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { userId } = parsed.data

    const membership = await prisma.tenantMembership.findFirst({ where: { tenantId, userId, isActive: true } })
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { loginAttempts: 0, lockedUntil: null, lastFailedLogin: null },
      select: { userId: true, name: true, email: true, role: true, isActive: true, loginAttempts: true, lockedUntil: true },
    })

    await prisma.userActivityLog.create({
      data: {
        userId,
        action: 'unlock_user',
        details: JSON.stringify({ unlockedBy: authUser.userId }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    })

    return NextResponse.json({ user: updatedUser, message: 'Usuario desbloqueado correctamente' })
  } catch (error) {
    console.error('Error desbloqueando usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function usersMetricsGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const authUser = authResult.user
    const tenantId = authUser.tenantId

    if (!tenantId && authUser.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (tenantId && !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const months = searchParams.get('months') ?? undefined
    const requestTenantId = searchParams.get('tenantId') ?? undefined

    const effectiveTenantId = requestTenantId && authUser.role === 'admin' ? requestTenantId : tenantId

    const parsedQuery = userMetricsQuerySchema.safeParse({ months })
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsedQuery.error.flatten() },
        { status: 400 },
      )
    }

    const metrics = await getUserMetrics(prisma, parsedQuery.data.months, effectiveTenantId)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error obteniendo métricas temporales:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
