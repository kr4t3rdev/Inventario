import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assertDisposableDatabase } from './ci/disposable-database.mjs';

/**
 * @description Siembra fixtures nuevas y atómicas solo en una base local desechable.
 * @returns {Promise<void>} Finaliza sin modificar identidades existentes.
 */
export interface E2EFixtureOwnership {
  tenantId: string;
  userId: string;
  email: string;
}

export async function run(): Promise<E2EFixtureOwnership> {
  assertDisposableDatabase(process.env);
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password || password.length < 16) throw new Error('E2E_TEST_PASSWORD requiere 16 caracteres.');
  const { PrismaClient } = await import('../src/generated/prisma');
  const { default: bcrypt } = await import('bcryptjs');
  const client = new PrismaClient();
  const fixtureId = `e2e-${randomUUID()}`;
  const E2E_TENANT_ID = fixtureId;
  try {
    const ownership = await client.$transaction(async (prisma) => {
      const E2E_USER = {
        email: `${fixtureId}@test.invalid`,
        password,
        name: 'E2E Playwright Test',
        role: 'user',
      }

      const E2E_FIXTURES = {
        almacenId: `${fixtureId}-almacen-principal`,
        categoriaId: `${fixtureId}-categoria-produccion`,
        unidadLitroId: `${fixtureId}-unidad-litro`,
        unidadKgId: `${fixtureId}-unidad-kilogramo`,
        productoAceiteId: `${fixtureId}-producto-aceite`,
        productoArrozId: `${fixtureId}-producto-arroz`,
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
          where: { tenantLicenseId: `${fixtureId}-license-1` },
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
            tenantLicenseId: `${fixtureId}-license-1`,
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
          where: { servicioId: `${fixtureId}-servicio-1` },
          update: {},
          create: {
            servicioId: `${fixtureId}-servicio-1`,
            tenantId: E2E_TENANT_ID,
            nombre: 'Reparación general',
            descripcion: 'Servicio de reparación general',
            precio: 500,
            moneda: 'CUP',
          },
        })
        await prisma.servicios.upsert({
          where: { servicioId: `${fixtureId}-servicio-2` },
          update: {},
          create: {
            servicioId: `${fixtureId}-servicio-2`,
            tenantId: E2E_TENANT_ID,
            nombre: 'Instalación',
            descripcion: 'Instalación de equipo',
            precio: 1500,
            moneda: 'CUP',
          },
        })
        await prisma.vendor.upsert({
          where: { vendorId: `${fixtureId}-proveedor-1` },
          update: {},
          create: {
            vendorId: `${fixtureId}-proveedor-1`,
            tenantId: E2E_TENANT_ID,
            nombre: 'Proveedor Demo',
          },
        })
        await prisma.cliente.upsert({
          where: { clienteId: `${fixtureId}-cliente-1` },
          update: {},
          create: {
            clienteId: `${fixtureId}-cliente-1`,
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

        await prisma.tenant.create({ data: { tenantId: E2E_TENANT_ID, nombre: 'Tenant E2E local' } })

        const user = await prisma.user.create({
          data: {
            name: E2E_USER.name, email: E2E_USER.email, password: hashedPassword,
            role: E2E_USER.role, isActive: true,
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
            reviewId: `${fixtureId}-review-suppress-prompt`,
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

        return { tenantId: E2E_TENANT_ID, userId: user.userId, email: E2E_USER.email };
      }
      return main();
    }, { timeout: 30000 });
    console.log('[E2E Seed] Fixtures locales creadas; credenciales no registradas.');
    return ownership;
  } finally {
    await client.$disconnect();
  }
}

/**
 * @description Elimina exclusivamente las fixtures identificadas por un manifiesto generado por run.
 * @param {E2EFixtureOwnership} ownership - Identificadores opacos del tenant y usuario E2E.
 * @returns {Promise<void>} Finaliza solo después de verificar la eliminación del tenant y usuario.
 */
export async function cleanup(ownership: E2EFixtureOwnership): Promise<void> {
  assertDisposableDatabase(process.env);
  if (!ownership.tenantId.startsWith('e2e-') || !ownership.userId) {
    throw new Error('Manifiesto de fixtures E2E inválido.');
  }
  const { PrismaClient } = await import('../src/generated/prisma');
  const client = new PrismaClient();
  try {
    await client.$executeRawUnsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('[E2E] Esquema desechable eliminado; no quedan datos de la corrida.');
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) Promise.reject(
  new Error('Usa Playwright con globalSetup/globalTeardown; el seed aislado no deja fixtures huérfanas.'),
).catch(() => {
  console.error('[E2E Seed] Ejecución directa rechazada; usa el ciclo E2E administrado.');
  process.exitCode = 1;
});
