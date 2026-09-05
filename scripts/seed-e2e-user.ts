/**
 * @description Script para crear/actualizar el usuario de pruebas E2E en la base de datos.
 * Solo debe ejecutarse en entornos de desarrollo.
 * El usuario creado tiene rol de admin para poder acceder a todas las rutas protegidas.
 */
import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'
import { E2E_TENANT_ID, ensureE2eTenant } from './e2e-fixtures'

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Este script no puede ejecutarse en producción.')
  process.exit(1)
}

const prisma = new PrismaClient()

const E2E_USER = {
  email: 'e2e@test.local',
  password: 'E2ETest123!',
  name: 'E2E Playwright Test',
  role: 'admin',
}

const E2E_FIXTURES = {
  almacenId: 'e2e-almacen-principal',
  categoriaId: 'e2e-categoria-produccion',
  unidadLitroId: 'e2e-unidad-litro',
  unidadKgId: 'e2e-unidad-kilogramo',
  productoAceiteId: 'e2e-producto-aceite',
  productoArrozId: 'e2e-producto-arroz',
}

/**
 * @description Crea el catálogo mínimo para los tests E2E de producción.
 * @returns {Promise<void>} Promesa resuelta cuando el catálogo queda listo.
 */
async function seedProductionCatalog(): Promise<void> {
  await prisma.almacen.upsert({
    where: { almacenId: E2E_FIXTURES.almacenId },
    update: {
      nombre: 'Almacén E2E Producción',
    },
    create: {
      almacenId: E2E_FIXTURES.almacenId,
      nombre: 'Almacén E2E Producción',
      tenant: { connect: { tenantId: E2E_TENANT_ID } },
    },
  })

  await prisma.categoria.upsert({
    where: { catId: E2E_FIXTURES.categoriaId },
    update: {
      nombre: 'Categoría E2E Producción',
      descripcion: 'Catálogo dedicado para pruebas E2E de producción',
      parentId: null,
    },
    create: {
      catId: E2E_FIXTURES.categoriaId,
      nombre: 'Categoría E2E Producción',
      descripcion: 'Catálogo dedicado para pruebas E2E de producción',
      parentId: null,
      tenantId: E2E_TENANT_ID,
    },
  })

  await prisma.unidad.upsert({
    where: { unidadId: E2E_FIXTURES.unidadLitroId },
    update: {
      nombre: 'Litro',
      simbolo: 'L',
    },
    create: {
      unidadId: E2E_FIXTURES.unidadLitroId,
      nombre: 'Litro',
      simbolo: 'L',
      tenantId: E2E_TENANT_ID,
    },
  })

  await prisma.unidad.upsert({
    where: { unidadId: E2E_FIXTURES.unidadKgId },
    update: {
      nombre: 'Kilogramo',
      simbolo: 'kg',
    },
    create: {
      unidadId: E2E_FIXTURES.unidadKgId,
      nombre: 'Kilogramo',
      simbolo: 'kg',
      tenantId: E2E_TENANT_ID,
    },
  })

  await prisma.producto.upsert({
    where: { id: E2E_FIXTURES.productoAceiteId },
    update: {
      nombre: 'E2E Aceite Volumen 1L',
      descripcion: 'Producto sembrado para pruebas E2E de unidades',
      precioCosto: 120,
      precioVenta: 180,
      stock: 50,
      stockMinimo: 5,
      categoriaId: E2E_FIXTURES.categoriaId,
      almacenId: E2E_FIXTURES.almacenId,
      unidadId: E2E_FIXTURES.unidadLitroId,
      subcategoriaId: null,
      puntoDeVentaId: null,
      vendorId: null,
      fotos: [],
    },
    create: {
      id: E2E_FIXTURES.productoAceiteId,
      nombre: 'E2E Aceite Volumen 1L',
      descripcion: 'Producto sembrado para pruebas E2E de unidades',
      precioCosto: 120,
      precioVenta: 180,
      stock: 50,
      stockMinimo: 5,
      categoriaId: E2E_FIXTURES.categoriaId,
      almacenId: E2E_FIXTURES.almacenId,
      unidadId: E2E_FIXTURES.unidadLitroId,
      tenantId: E2E_TENANT_ID,
      fotos: [],
    },
  })

  await prisma.producto.upsert({
    where: { id: E2E_FIXTURES.productoArrozId },
    update: {
      nombre: 'E2E Arroz Masa 1kg',
      descripcion: 'Producto sembrado para pruebas E2E de unidades',
      precioCosto: 90,
      precioVenta: 140,
      stock: 50,
      stockMinimo: 5,
      categoriaId: E2E_FIXTURES.categoriaId,
      almacenId: E2E_FIXTURES.almacenId,
      unidadId: E2E_FIXTURES.unidadKgId,
      subcategoriaId: null,
      puntoDeVentaId: null,
      vendorId: null,
      fotos: [],
    },
    create: {
      id: E2E_FIXTURES.productoArrozId,
      nombre: 'E2E Arroz Masa 1kg',
      descripcion: 'Producto sembrado para pruebas E2E de unidades',
      precioCosto: 90,
      precioVenta: 140,
      stock: 50,
      stockMinimo: 5,
      categoriaId: E2E_FIXTURES.categoriaId,
      almacenId: E2E_FIXTURES.almacenId,
      unidadId: E2E_FIXTURES.unidadKgId,
      tenantId: E2E_TENANT_ID,
      fotos: [],
    },
  })
}

/**
 * @description Garantiza la licencia activa del tenant E2E con los features de
 * servicios habilitados (sin ellos el plan Básico no expone /busy/servicios).
 * @returns {Promise<void>} Licencia activa con featureOverrides de servicios.
 */
async function seedLicenseE2E(): Promise<void> {
  const plan = await prisma.plan.findFirst({ orderBy: { precio: 'asc' } })
  if (!plan) throw new Error('No hay planes en la DB — ejecuta pnpm run seed:plans primero')

  const now = new Date()
  const expiry = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  await prisma.tenantLicense.upsert({
    where: { tenantLicenseId: 'e2e-license-1' },
    update: {
      planId: plan.planId,
      activa: true,
      expiracion: expiry,
      featureOverrides: {
        servicios: true,
        'venta-servicios': true,
        'compras-servicios': true,
      },
    },
    create: {
      tenantLicenseId: 'e2e-license-1',
      tenantId: E2E_TENANT_ID,
      planId: plan.planId,
      activa: true,
      inicio: now,
      expiracion: expiry,
      maxUsuarios: 100,
      maxAlmacenes: 10,
      maxProductos: 90000,
      maxClientes: 90000,
      featureOverrides: {
        servicios: true,
        'venta-servicios': true,
        'compras-servicios': true,
      },
      listPriceUsd: 0,
      finalPriceUsd: 0,
    },
  })
}

/**
 * @description Garantiza el catálogo mínimo de servicios/vendors/clientes para
 * probar el carrito con toggle Venta/Compra.
 * @returns {Promise<void>} Catálogo de servicios y contrapartes del tenant E2E.
 */
async function seedServiciosCatalog(): Promise<void> {
  await prisma.servicios.upsert({
    where: { servicioId: 'e2e-servicio-1' },
    update: {},
    create: {
      servicioId: 'e2e-servicio-1',
      tenantId: E2E_TENANT_ID,
      nombre: 'Reparación general',
      descripcion: 'Servicio de reparación general',
      precio: 500,
      moneda: 'CUP',
    },
  })
  await prisma.servicios.upsert({
    where: { servicioId: 'e2e-servicio-2' },
    update: {},
    create: {
      servicioId: 'e2e-servicio-2',
      tenantId: E2E_TENANT_ID,
      nombre: 'Instalación',
      descripcion: 'Instalación de equipo',
      precio: 1500,
      moneda: 'CUP',
    },
  })
  await prisma.vendor.upsert({
    where: { vendorId: 'e2e-proveedor-1' },
    update: {},
    create: {
      vendorId: 'e2e-proveedor-1',
      tenantId: E2E_TENANT_ID,
      nombre: 'Proveedor Demo',
    },
  })
  await prisma.cliente.upsert({
    where: { clienteId: 'e2e-cliente-1' },
    update: {},
    create: {
      clienteId: 'e2e-cliente-1',
      tenantId: E2E_TENANT_ID,
      nombre: 'Cliente Demo',
    },
  })
}

/**
 * @description Ejecuta la siembra del usuario y del catálogo E2E.
 * @returns {Promise<void>} Promesa resuelta cuando todas las fixtures quedan listas.
 */
async function main() {
  const hashedPassword = await bcrypt.hash(E2E_USER.password, 10)

  await ensureE2eTenant(prisma)

  const user = await prisma.user.upsert({
    where: { email: E2E_USER.email },
    update: {
      password: hashedPassword,
      isActive: true,
      loginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      name: E2E_USER.name,
      email: E2E_USER.email,
      password: hashedPassword,
      role: E2E_USER.role,
      isActive: true,
    },
  })

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: E2E_TENANT_ID,
        userId: user.userId,
      },
    },
    update: {
      tenantRole: 'manager',
      isActive: true,
    },
    create: {
      tenantId: E2E_TENANT_ID,
      userId: user.userId,
      tenantRole: 'manager',
      isActive: true,
    },
  })

  await prisma.review.upsert({
    where: {
      tenantId_userId: {
        tenantId: E2E_TENANT_ID,
        userId: user.userId,
      },
    },
    update: {},
    create: {
      reviewId: 'e2e-review-suppress-prompt',
      tenantId: E2E_TENANT_ID,
      userId: user.userId,
      rating: 5,
      comment: 'Fixture para mantener las pruebas E2E deterministas.',
      isApproved: false,
      isPositive: true,
    },
  })

  await seedProductionCatalog()
  await seedLicenseE2E()
  await seedServiciosCatalog()

  console.log(`[E2E Seed] Usuario listo: ${E2E_USER.email} / ${E2E_USER.password}`)
  console.log('[E2E Seed] Catálogo listo: E2E Aceite Volumen 1L, E2E Arroz Masa 1kg')
  console.log('[E2E Seed] Licencia E2E con features servicios activados y catálogo de servicios')
}

main()
  .catch((err) => {
    console.error('[E2E Seed] Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
