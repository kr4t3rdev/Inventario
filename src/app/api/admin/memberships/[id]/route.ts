import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

/**
 * @description Aprueba una solicitud de membresía pendiente.
 * El manager del tenant o el admin global pueden aprobar.
 * Asigna el rol seleccionado, activa la membresía y activa al usuario.
 *
 * @param {NextRequest} request - Request con tenantRole en el body.
 * @param {{ params: { id: string } }} context - ID de la membresía.
 * @returns {Promise<NextResponse>} Resultado de la operación.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) {
      return authResult as Response
    }

    const user = authResult.user
    const { id: membershipId } = await params
    const body = await request.json().catch(() => ({}))
    const { tenantRole } = body

    if (!tenantRole || typeof tenantRole !== 'string') {
      return NextResponse.json(
        { error: 'El rol del tenant es requerido' },
        { status: 400 },
      )
    }

    // Validar que el rol sea válido
    const validRoles = ['manager', 'economico', 'dependiente', 'admin']
    if (!validRoles.includes(tenantRole)) {
      return NextResponse.json(
        { error: `Rol inválido: ${tenantRole}. Roles válidos: ${validRoles.join(', ')}` },
        { status: 400 },
      )
    }

    // Buscar la membresía pendiente
    const membership = await prisma.tenantMembership.findUnique({
      where: { membershipId },
      select: {
        membershipId: true,
        tenantId: true,
        userId: true,
        isActive: true,
        user: { select: { userId: true, name: true, email: true } },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Solicitud de membresía no encontrada' },
        { status: 404 },
      )
    }

    if (membership.isActive) {
      return NextResponse.json(
        { error: 'Esta membresía ya está activa' },
        { status: 409 },
      )
    }

    // Verificar permisos: admin global o manager del tenant
    const isPlatformAdmin = user.role === 'admin'
    const isTenantManager = user.tenantRole === 'manager' && user.tenantId === membership.tenantId

    if (!isPlatformAdmin && !isTenantManager) {
      return NextResponse.json(
        { error: 'No tenés permisos para aprobar esta solicitud' },
        { status: 403 },
      )
    }

    // Activar la membresía con el rol seleccionado
    await prisma.tenantMembership.update({
      where: { membershipId },
      data: {
        isActive: true,
        tenantRole,
      },
    })

    // Activar al usuario y cerrar el flujo de onboarding del worker
    await prisma.user.update({
      where: { userId: membership.userId },
      data: {
        isActive: true,
        onboardingStatus: null,
      },
    })

    // Crear registro en Empleado para que aparezca en la lista de empleados
    // Separar nombre completo en nombre y apellido
    const nameParts = membership.user.name.trim().split(' ')
    const nombre = nameParts[0]
    const apellido = nameParts.slice(1).join(' ') || nombre

    const cargoMap: Record<string, string> = {
      manager: 'Director / Manager',
      economico: 'Económico',
      dependiente: 'Dependiente',
      admin: 'Administrador',
    }

    let empleadoCreado = false

    // Solo crear si no existe ya un empleado con ese nombre en el tenant
    const existingEmpleado = await prisma.empleado.findFirst({
      where: {
        tenantId: membership.tenantId,
        nombre,
        apellido,
      },
    })

    if (existingEmpleado) {
      console.log('[Membership Approve] Empleado ya existe:', existingEmpleado.empleadoId)
    } else {
      const cargo = cargoMap[tenantRole] || tenantRole
      console.log('[Membership Approve] Creando Empleado:', { nombre, apellido, cargo, tenantId: membership.tenantId })
      await prisma.empleado.create({
        data: {
          tenantId: membership.tenantId,
          nombre,
          apellido,
          cargo,
          salarioBases: 0,
          fechaContratacion: new Date(),
        },
      })
      empleadoCreado = true
      console.log('[Membership Approve] Empleado creado exitosamente')
    }

    return NextResponse.json({ success: true, empleadoCreado })
  } catch (error) {
    console.error('[Membership Approve] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
