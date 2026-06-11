/**
 * @description Server Actions para Mi Empresa. Reemplazan los fetch("/api/mi-empresa") en client components.
 *
 * @module features/mi-empresa/actions
 */
'use server';

import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { clearEan13Codes, resetProductsForEan13 } from '@/lib/ean13-reset';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const miEmpresaUpsertSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  propietario: z.string().min(1, 'El propietario debe tener al menos 1 carácter').optional().nullable(),
  direccion: z.string().min(1, 'La dirección debe tener al menos 1 carácter').optional().nullable(),
  telefono: z
    .string()
    .regex(/^[0-9\-\+\s\(\)]+$/, 'Teléfono inválido')
    .optional()
    .nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  carnetIdentidad: z.string().min(1, 'Cédula debe tener al menos 1 carácter').optional().nullable(),
  nit: z.string().min(1, 'NIT debe tener al menos 1 carácter').optional().nullable(),
  licenciaOperacion: z
    .string()
    .min(1, 'Licencia debe tener al menos 1 carácter')
    .optional()
    .nullable(),
  logoUrl: z.string().url('URL del logo inválida').optional().nullable(),
  cuentaBancariaId: z.string().min(1, 'ID de cuenta inválido').optional().nullable(),
  usaCodigoEan13: z.boolean().optional(),
  confirmReset: z.boolean().optional(),
});

/**
 * @description Obtiene la configuración de Mi Empresa para el tenant actual.
 * Reemplaza GET /api/mi-empresa.
 *
 * @returns Datos de Mi Empresa o null si no existe
 */
export const getMiEmpresaAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const miEmpresa = await prisma.miEmpresa.findUnique({
    where: { tenantId },
    select: {
      nombre: true,
      propietario: true,
      direccion: true,
      telefono: true,
      email: true,
      carnetIdentidad: true,
      nit: true,
      licenciaOperacion: true,
      logoUrl: true,
      cuentaBancariaId: true,
      usaCodigoEan13: true,
      cuentaBancaria: {
        select: {
          nombreBanco: true,
          numeroCuenta: true,
          moneda: true,
          tipoCuenta: true,
          isActive: true,
        },
      },
    },
  });

  return miEmpresa;
});

/**
 * @description Actualiza (o crea) la configuración de Mi Empresa para el tenant actual.
 * Reemplaza PUT /api/mi-empresa.
 *
 * Maneja las transiciones de EAN-13 (reset de productos al activar, limpieza de
 * códigos al desactivar). Valida input con Zod y devuelve errores de campo
 * para que el cliente los muestre en cada FormField.
 */
export const updateMiEmpresaAction = withAction(
  async (input: unknown, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    const parsed = miEmpresaUpsertSchema.parse(input);
    const data = parsed;

    const current = await prisma.miEmpresa.findUnique({ where: { tenantId } });

    const isTogglingOn =
      !current?.usaCodigoEan13 && data.usaCodigoEan13 === true;
    const isTogglingOff =
      current?.usaCodigoEan13 && data.usaCodigoEan13 === false;

    if (isTogglingOn) {
      if (!data.confirmReset) {
        throw new ActionError(
          'Activating EAN-13 will delete all existing products. Please confirm by sending confirmReset: true',
          'CONFIRMATION_REQUIRED',
        );
      }
      await resetProductsForEan13(tenantId);
    }

    if (isTogglingOff) {
      await clearEan13Codes(tenantId);
    }

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.propietario !== undefined) updateData.propietario = data.propietario;
    if (data.direccion !== undefined) updateData.direccion = data.direccion;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.carnetIdentidad !== undefined)
      updateData.carnetIdentidad = data.carnetIdentidad;
    if (data.nit !== undefined) updateData.nit = data.nit;
    if (data.licenciaOperacion !== undefined)
      updateData.licenciaOperacion = data.licenciaOperacion;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.cuentaBancariaId !== undefined)
      updateData.cuentaBancariaId = data.cuentaBancariaId;
    if (data.usaCodigoEan13 !== undefined)
      updateData.usaCodigoEan13 = data.usaCodigoEan13;

    const miEmpresa = await prisma.miEmpresa.upsert({
      where: { tenantId },
      create: {
        tenantId,
        nombre: data.nombre ?? 'Mi Empresa',
        propietario: data.propietario ?? null,
        direccion: data.direccion ?? null,
        telefono: data.telefono ?? null,
        email: data.email ?? null,
        carnetIdentidad: data.carnetIdentidad ?? null,
        nit: data.nit ?? null,
        licenciaOperacion: data.licenciaOperacion ?? null,
        logoUrl: data.logoUrl ?? null,
        cuentaBancariaId: data.cuentaBancariaId ?? null,
        usaCodigoEan13: data.usaCodigoEan13 ?? false,
      },
      update: updateData,
      include: {
        cuentaBancaria: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true,
            tipoCuenta: true,
            isActive: true,
          },
        },
      },
    });

    return {
      data: miEmpresa,
      message: isTogglingOn
        ? 'EAN-13 activated, all products and categories reset'
        : isTogglingOff
          ? 'EAN-13 deactivated, EAN-13 codes cleared'
          : 'Mi Empresa updated',
    };
  },
);
