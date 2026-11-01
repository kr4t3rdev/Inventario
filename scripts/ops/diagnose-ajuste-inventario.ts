/**
 * @description Diagnóstico de solo lectura: reconstruye el historial de stock
 * del producto afectado por un ajuste y compara el stock legacy
 * (`Producto.stock`) con el stock materializado por ubicación
 * (`StockUbicacion`). NO escribe ni modifica ningún dato.
 *
 * Uso:
 *   railway run pnpm exec tsx scripts/ops/diagnose-ajuste-inventario.ts <email> [productoId]
 */
import { PrismaClient } from '../../src/generated/prisma';

const datasourceUrl =
  process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    'Falta DATABASE_PUBLIC_URL o DATABASE_URL en el entorno (usa `railway run`).',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });

const email = process.argv[2] ?? 'migadevv@gmail.com';
const productoIdFiltro = process.argv[3];

async function main(): Promise<void> {
  const usuario = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      userId: true,
      email: true,
      name: true,
      tenantMemberships: {
        where: { isActive: true },
        select: { tenantId: true, tenantRole: true },
      },
    },
  });

  if (!usuario?.tenantMemberships[0]) {
    console.log(`Usuario o membership no encontrada: ${email}`);
    return;
  }

  const tenantId = usuario.tenantMemberships[0].tenantId;
  console.log('=== USUARIO ===', {
    email: usuario.email,
    nombre: usuario.name,
    tenantId,
    tenantRole: usuario.tenantMemberships[0].tenantRole,
  });

  const ajustes = await prisma.ajusteInventario.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n=== AJUSTES DEL TENANT (${ajustes.length}) ===`);
  for (const ajuste of ajustes) {
    const producto = await prisma.producto.findFirst({
      where: { id: ajuste.productoId, tenantId },
      select: { nombre: true, stock: true },
    });
    console.log({
      id: ajuste.id,
      createdAt: ajuste.createdAt,
      producto: producto?.nombre,
      tipoUbicacion: ajuste.tipoUbicacion,
      ubicacionId: ajuste.ubicacionId,
      motivo: ajuste.motivo,
      teorica: ajuste.cantidadTeorica,
      contada: ajuste.cantidadContada,
      diferencia: ajuste.diferencia,
      costoTotal: ajuste.costoTotal,
      estado: ajuste.estado,
    });
  }

  const productos = productoIdFiltro
    ? await prisma.producto.findMany({
        where: { id: productoIdFiltro, tenantId },
        select: { id: true, nombre: true, stock: true, almacenId: true },
      })
    : await prisma.producto.findMany({
        where: { tenantId },
        select: { id: true, nombre: true, stock: true, almacenId: true },
        take: 50,
      });

  console.log(`\n=== STOCK LEGACY vs STOCK POR UBICACIÓN (${productos.length} productos) ===`);
  let desincronizados = 0;
  for (const producto of productos) {
    const ubicaciones = await prisma.stockUbicacion.findMany({
      where: { productoId: producto.id },
      select: {
        tipoUbicacion: true,
        ubicacionId: true,
        cantidad: true,
        cantidadReservada: true,
        cantidadDisponible: true,
      },
    });
    const suma = ubicaciones.reduce((acc, u) => acc + u.cantidad, 0);
    const coincide = suma === producto.stock;
    if (!coincide) desincronizados += 1;
    console.log({
      producto: producto.nombre,
      productoId: producto.id,
      legacyStock: producto.stock,
      sumaStockUbicacion: suma,
      coincide,
      ubicaciones,
    });
  }
  console.log(`\nProductos desincronizados: ${desincronizados}/${productos.length}`);

  const productoObjetivo = productos[0];
  if (productoObjetivo) {
    const movimientos = await prisma.stockMoveLine.findMany({
      where: { tenantId, productoId: productoObjetivo.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipoOrigen: true,
        origenId: true,
        secuencia: true,
        tipoUbicacion: true,
        ubicacionId: true,
        cantidad: true,
        costoUnitario: true,
        costoTotal: true,
        createdAt: true,
      },
    });
    console.log(
      `\n=== KARDEX COMPLETO de "${productoObjetivo.nombre}" (${movimientos.length} movimientos) ===`,
    );
    for (const movimiento of movimientos) {
      console.log({
        createdAt: movimiento.createdAt,
        tipoOrigen: movimiento.tipoOrigen,
        secuencia: movimiento.secuencia,
        ubicacion: `${movimiento.tipoUbicacion}:${movimiento.ubicacionId}`,
        cantidad: movimiento.cantidad,
        costoTotal: movimiento.costoTotal,
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('ERROR:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
