import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

interface ApproveBody {
  tenantName?: string;
  planId?: string;
  licenseDurationDays?: number;
}

/**
 * @description POST /api/admin/global/users/[id]/approve
 * Aprueba un usuario tipo company en awaiting_global_approval.
 * Crea un tenant, una membresía activa como manager, y opcionalmente una licencia.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateUser(request);
    if ('status' in auth) return auth as Response;

    if (!isAdminRole(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id: userId } = await context.params;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const body = (await request.json()) as ApproveBody;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        email: true,
        onboardingStatus: true,
        onboardingType: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.onboardingStatus !== 'awaiting_global_approval') {
      return NextResponse.json(
        { error: 'El usuario no está esperando aprobación global' },
        { status: 400 },
      );
    }

    const tenantName = body.tenantName?.trim() || 'Nueva Empresa';
    const slug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Verificar que el slug sea único
    const existingSlug = await prisma.tenant.findUnique({
      where: { slug },
      select: { tenantId: true },
    });

    const finalSlug = existingSlug
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el tenant
      const tenant = await tx.tenant.create({
        data: {
          nombre: tenantName,
          slug: finalSlug,
        },
      });

      // 2. Crear moneda principal por defecto (CUP) si no existe
      await tx.moneda.upsert({
        where: { codigo: 'CUP' },
        update: {},
        create: {
          codigo: 'CUP',
          nombre: 'Peso Cubano',
          simbolo: '$',
          esPrincipal: true,
          isActive: true,
        },
      })

      // 3. Crear membresía activa como manager
      const membership = await tx.tenantMembership.create({
        data: {
          tenantId: tenant.tenantId,
          userId: user.userId,
          tenantRole: 'manager',
          isActive: true,
        },
      });

      // 4. Actualizar usuario
      const updatedUser = await tx.user.update({
        where: { userId: user.userId },
        data: {
          role: 'manager',
          isActive: true,
          onboardingStatus: 'completed',
          activatedAt: new Date(),
        },
      });

      // 5. Opcionalmente crear licencia
      let license = null;
      if (body.planId) {
        const plan = await tx.plan.findUnique({
          where: { planId: body.planId },
        });

        if (plan) {
          const durationDays =
            typeof body.licenseDurationDays === 'number' && body.licenseDurationDays > 0
              ? body.licenseDurationDays
              : plan.duracionDias;

          const expiracion = new Date();
          expiracion.setDate(expiracion.getDate() + durationDays);

          license = await tx.tenantLicense.create({
            data: {
              tenantId: tenant.tenantId,
              planId: plan.planId,
              expiracion,
              maxUsuarios: plan.maxUsuarios,
              maxAlmacenes: plan.maxAlmacenes,
              maxProductos: plan.maxProductos,
            },
          });
        }
      }

      return { tenant, membership, user: updatedUser, license };
    });

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
    });
  } catch (error) {
    console.error('Error aprobando usuario global:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
