import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant, assertTenantAccess } from "@/lib/services/tenant-scope"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

export async function getClientesHandler(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const clientes = await prisma.cliente.findMany({ where: { tenantId }, include: { Venta: true } })
  return NextResponse.json(clientes)
}

export async function createClienteHandler(request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const body = await request.json()
  const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono } = body
  const clientes = await prisma.cliente.create({
    data: { nombre, direccion, telefono, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, tenantId },
  })
  return NextResponse.json(clientes)
}

export async function getClienteByIdHandler(req: NextRequest, context: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const { id } = await context.params
  const cliente = await prisma.cliente.findUnique({ where: { clienteId: id }, include: { Venta: true } })
  if (!cliente) return NextResponse.json({ error: "cliente no encontrado" }, { status: 404 })
  assertTenantAccess(cliente.tenantId, tenantId, 'Cliente')
  return NextResponse.json(cliente)
}

export async function updateClienteHandler(request: NextRequest, context: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const { id } = await context.params
  const body = await request.json()
  const { nombre, numeroCuentaCUP, numeroCuentaUSD, numeroContrato, direccion, telefono } = body
  const existing = await prisma.cliente.findUnique({ where: { clienteId: id }, select: { tenantId: true } })
  assertTenantAccess(existing?.tenantId, tenantId, 'Cliente')
  const cliente = await prisma.cliente.update({
    where: { clienteId: id },
    data: { nombre, direccion, telefono, numeroCuentaCUP, numeroCuentaUSD, numeroContrato },
  })
  return NextResponse.json(cliente)
}

export async function deleteClienteHandler(request: NextRequest, context: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const { id } = await context.params
  const existing = await prisma.cliente.findUnique({ where: { clienteId: id }, select: { tenantId: true } })
  assertTenantAccess(existing?.tenantId, tenantId, 'Cliente')
  await prisma.cliente.delete({ where: { clienteId: id } })
  return NextResponse.json({ success: true, id })
}
