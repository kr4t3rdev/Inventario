import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant } from "@/lib/services/tenant-scope"
import { getNextVendorCode, generateVendorEan13, initializeVendorCodeSequence } from "@/lib/vendor-code-utils"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

export async function getVendorsHandler(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const vendors = await prisma.vendor.findMany({
    where: { tenantId },
    include: { productos: { select: { id: true, nombre: true } }, contratos: true },
  })
  return NextResponse.json(vendors.map((vendor) => {
    const vendorCode = vendor.vendorCode
    const ean13Code = vendorCode ? generateVendorEan13(vendorCode) : null
    return { ...vendor, vendorCode, ean13Code, proveedorCodigo: vendorCode || null }
  }))
}

export async function createVendorHandler(req: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const body = await req.json()
  const { nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato, vendorCode } = body
  if (vendorCode) return NextResponse.json({ error: 'El código del proveedor se asigna automáticamente' }, { status: 400 })
  await initializeVendorCodeSequence(prisma)
  const assignedVendorCode = await getNextVendorCode(prisma)
  const vendor = await prisma.vendor.create({ data: { nombre, vendorCode: assignedVendorCode, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato, tenantId } })
  const ean13Code = generateVendorEan13(vendor.vendorCode!)
  return NextResponse.json({ ...vendor, ean13Code }, { status: 201 })
}

export async function getVendorByIdHandler(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const vendor = await prisma.vendor.findUnique({ where: { vendorId: id }, include: { productos: true, contratos: true } })
    if (!vendor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    const ean13Code = vendor.vendorCode ? generateVendorEan13(vendor.vendorCode) : null
    return NextResponse.json({ ...vendor, ean13Code })
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return NextResponse.json({ error: 'Error al obtener proveedor' }, { status: 500 })
  }
}

export async function updateVendorHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato, vendorCode } = body
    if (vendorCode) return NextResponse.json({ error: 'El código del proveedor no puede ser modificado' }, { status: 400 })
    const vendor = await prisma.vendor.update({ where: { vendorId: id }, data: { nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato } })
    const ean13Code = vendor.vendorCode ? generateVendorEan13(vendor.vendorCode) : null
    return NextResponse.json({ ...vendor, ean13Code })
  } catch (error) {
    console.error('Error updating vendor:', error)
    return NextResponse.json({ error: 'Error al actualizar vendor' }, { status: 500 })
  }
}

export async function deleteVendorHandler(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await prisma.vendor.delete({ where: { vendorId: id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error deleting vendor:', error)
    return NextResponse.json({ error: 'Error al eliminar vendor' }, { status: 500 })
  }
}
