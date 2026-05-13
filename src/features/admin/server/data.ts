/**
 * @description Data fetcher para la página de Admin Usuarios.
 * Se ejecuta en el servidor (Server Component) para obtener los datos
 * iniciales sin depender de fetching del lado del cliente.
 *
 * Replica lo que hacen getGlobalUsersAction + getAdminPlanesAction
 * pero diseñado específicamente para Server Components.
 *
 * @module features/admin/server/data
 */

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'

export interface AdminUsersPageData {
  users: Array<{
    userId: string
    name: string
    email: string
    role: string
    onboardingStatus: string | null
    onboardingType: string | null
    tenantRole: string | null
    isActive: boolean
    lockedUntil: Date | null
    expiresAt: Date | null
    createdAt: Date
    loginAttempts: number
    tenants: Array<{
      tenantId: string
      tenantRole: string | null
      isActive: boolean
      tenant: { nombre: string }
    }>
  }>
  total: number
  planes: Array<{
    planId: string
    nombre: string
    precio: number | null
    billingCycle: string | null
    maxUsuarios: number
    maxAlmacenes: number
    maxProductos: number
  }>
}

/**
 * @description Obtiene los datos iniciales para la página de Admin Usuarios.
 * Usa `getCurrentUser()` + Prisma directamente para evitar el waterfall
 * cliente → Server Action.
 *
 * @returns {Promise<AdminUsersPageData | null>} Datos o null si no autenticado / no admin
 */
export async function getAdminUsersPageData(): Promise<AdminUsersPageData | null> {
  const user = await getCurrentUser()

  // Solo admin puede ver esta página
  if (!user || user.role !== 'admin') return null

  const [users, total, planes] = await Promise.all([
    prisma.user.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        tenantMemberships: {
          include: { tenant: { select: { nombre: true } } },
        },
      },
    }),

    prisma.user.count(),

    prisma.plan.findMany({
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    users: users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role,
      onboardingStatus: u.onboardingStatus,
      onboardingType: u.onboardingType,
      tenantRole: u.tenantMemberships.find((m) => m.isActive)?.tenantRole ?? null,
      isActive: u.isActive,
      lockedUntil: u.lockedUntil,
      expiresAt: u.expiresAt,
      createdAt: u.createdAt,
      loginAttempts: u.loginAttempts,
      tenants: u.tenantMemberships.map((m) => ({
        tenantId: m.tenantId,
        tenantRole: m.tenantRole,
        isActive: m.isActive,
        tenant: { nombre: m.tenant.nombre },
      })),
    })),
    total,
    planes: planes.map((p) => ({
      planId: p.planId,
      nombre: p.nombre,
      precio: p.precio,
      billingCycle: `${p.duracionDias} días`,
      maxUsuarios: p.maxUsuarios,
      maxAlmacenes: p.maxAlmacenes,
      maxProductos: p.maxProductos,
    })),
  }
}
