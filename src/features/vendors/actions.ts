/**
 * @description Server Actions para el feature de Proveedores (Vendors).
 *
 * Incluye lógica de asignación automática de vendorCode (secuencia 01-99)
 * y generación de EAN-13 para cada proveedor.
 *
 * @module features/vendors/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { replaceOwnerAsset } from '@/lib/upload/cloudinary-admin';
import { vendorSchema, vendorUpdateSchema } from './schemas';
import { getNextVendorCode, initializeVendorCodeSequence, generateVendorEan13 } from '@/lib/vendor-code-utils';
import type { VendorInput, VendorUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Vendor } from '@/app/models/model';

const VENDOR_SELECT = {
  vendorId: true,
  nombre: true,
  vendorCode: true,
  direccion: true,
  telefono: true,
  contacto: true,
  cuentaCUP: true,
  cuentaUSD: true,
  logo: true,
  contrato: true,
  createdAt: true,
  updatedAt: true,
} as const;

type VendorRow = {
  vendorId: string;
  nombre: string;
  vendorCode: string | null;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  cuentaCUP: string | null;
  cuentaUSD: string | null;
  logo: string | null;
  contrato: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VendorActionItem = Omit<Vendor, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  vendorCode?: string | null;
  ean13Code?: string | null;
  proveedorCodigo?: string | null;
};

function enrichVendor(vendor: VendorRow): VendorActionItem {
  const vendorCode = vendor.vendorCode ?? undefined;
  const ean13Code = vendor.vendorCode ? generateVendorEan13(vendor.vendorCode) : null;
  return {
    ...vendor,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
    vendorCode: vendorCode ?? null,
    ean13Code,
    proveedorCodigo: vendorCode ?? null,
  };
}

export const getVendorsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const vendors = await prisma.vendor.findMany({
    where: { tenantId },
    select: VENDOR_SELECT,
    orderBy: { nombre: 'asc' },
  });
  return vendors.map(enrichVendor);
});

export const getVendorByIdAction = withAction(async (vendorId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const vendor = await prisma.vendor.findFirst({
    where: { vendorId, tenantId },
    select: VENDOR_SELECT,
  });
  if (!vendor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
  return enrichVendor(vendor);
});

export const createVendorAction = withAction(async (input: VendorInput, user: AuthenticatedUser) => {
  const parsed = vendorSchema.parse(input);
  const tenantId = requireTenant(user);

  await initializeVendorCodeSequence(prisma);
  const assignedVendorCode = await getNextVendorCode(prisma);

  const vendor = await prisma.vendor.create({
    data: {
      nombre: parsed.nombre,
      vendorCode: assignedVendorCode,
      direccion: parsed.direccion ?? null,
      telefono: parsed.telefono ?? null,
      contacto: parsed.contacto ?? null,
      cuentaCUP: parsed.cuentaCUP ?? null,
      cuentaUSD: parsed.cuentaUSD ?? null,
      logo: parsed.logo ?? null,
      tenantId,
    },
    select: VENDOR_SELECT,
  });

  if (parsed.logoAsset) {
    await replaceOwnerAsset({
      tenantId,
      ownerType: 'vendor',
      ownerId: vendor.vendorId,
      slot: 'logo',
      asset: parsed.logoAsset,
    });
  }

  revalidatePath('/busy/vendor');
  return enrichVendor(vendor);
});

export const updateVendorAction = withAction(async (input: VendorUpdateInput, user: AuthenticatedUser) => {
  const parsed = vendorUpdateSchema.parse(input);
  const { vendorId, logoAsset, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.vendor.findFirst({
    where: { vendorId, tenantId },
    select: { vendorId: true, vendorCode: true },
  });
  if (!existing) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

  const vendor = await prisma.vendor.update({
    where: { vendorId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.direccion !== undefined && { direccion: data.direccion }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.contacto !== undefined && { contacto: data.contacto }),
      ...(data.cuentaCUP !== undefined && { cuentaCUP: data.cuentaCUP }),
      ...(data.cuentaUSD !== undefined && { cuentaUSD: data.cuentaUSD }),
      ...(data.logo !== undefined && { logo: data.logo }),
    },
    select: VENDOR_SELECT,
  });

  if (logoAsset) {
    await replaceOwnerAsset({
      tenantId,
      ownerType: 'vendor',
      ownerId: vendor.vendorId,
      slot: 'logo',
      asset: logoAsset,
    });
  }

  revalidatePath('/busy/vendor');
  return enrichVendor(vendor);
});

/**
 * @description Elimina un proveedor por ID, bloqueando el borrado si tiene dependencias.
 *
 * @throws ActionError si el proveedor no existe
 * @throws ActionError con código PROVEEDOR_EN_USO si tiene productos, compras,
 * gastos, deudas, cuentas por pagar, anticipos, órdenes de compra, servicios
 * o contratos asociados (B-03: la cascada de DB borraba todo físicamente)
 */
export const deleteVendorAction = withAction(async (vendorId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.vendor.findFirst({
    where: { vendorId, tenantId },
    select: { vendorId: true },
  });
  if (!existing) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

  const [
    productos,
    gastosCompra,
    comprasProductos,
    comprasDocumentos,
    ordenesCompra,
    deudas,
    cuentasPorPagar,
    anticipos,
    comprasServicio,
    contratos,
  ] = await Promise.all([
    prisma.producto.count({ where: { vendorId, tenantId } }),
    prisma.gastoCompra.count({ where: { vendorId, tenantId } }),
    prisma.compraProducto.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.compraDocumento.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.ordenCompra.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.deudaCash.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.cuentaPorPagar.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.anticipo.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.compraServicio.count({ where: { proveedorId: vendorId, tenantId } }),
    prisma.contrato.count({ where: { vendorId, tenantId } }),
  ]);

  const total =
    productos + gastosCompra + comprasProductos + comprasDocumentos +
    ordenesCompra + deudas + cuentasPorPagar + anticipos + comprasServicio + contratos;

  if (total > 0) {
    throw new ActionError(
      `No se puede eliminar el proveedor porque tiene registros asociados: ${productos} producto(s), ${comprasProductos} compra(s) de productos, ${comprasDocumentos} documento(s) de compra, ${gastosCompra} gasto(s) de compra, ${ordenesCompra} orden(es) de compra, ${comprasServicio} compra(s) de servicio, ${cuentasPorPagar} cuenta(s) por pagar, ${deudas} deuda(s), ${anticipos} anticipo(s), ${contratos} contrato(s).`,
      'PROVEEDOR_EN_USO',
    );
  }

  await prisma.vendor.delete({ where: { vendorId } });
  revalidatePath('/busy/vendor');
  return { id: vendorId, eliminado: true };
});
