/**
 * @description Script para crear/actualizar el usuario de pruebas E2E en la base de datos.
 * Solo debe ejecutarse en entornos de desarrollo.
 * El usuario creado tiene rol de admin para poder acceder a todas las rutas protegidas.
 */
import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

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
      fotos: [],
    },
  })
}

/**
 * @description Ejecuta la siembra del usuario y del catálogo E2E.
 * @returns {Promise<void>} Promesa resuelta cuando todas las fixtures quedan listas.
 */
async function main() {
  const hashedPassword = await bcrypt.hash(E2E_USER.password, 10)

  await prisma.user.upsert({
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

  await seedProductionCatalog()

  console.log(`[E2E Seed] Usuario listo: ${E2E_USER.email} / ${E2E_USER.password}`)
  console.log('[E2E Seed] Catálogo listo: E2E Aceite Volumen 1L, E2E Arroz Masa 1kg')
}

main()
  .catch((err) => {
    console.error('[E2E Seed] Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
