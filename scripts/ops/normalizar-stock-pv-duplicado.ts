/**
 * @description Normaliza el stock duplicado en puntos de venta.
 *
 * Contexto: antes de la fase 5 (b53e7fa4), crear un producto con almacén Y
 * punto de venta escribía el stock completo en AMBAS ubicaciones, por lo que
 * `stockTotal` de esos productos quedó duplicado en la base de datos.
 *
 * Este script detecta y corrige SOLO los duplicados provables: filas de
 * punto_venta cuyo valor sigue siendo idéntico al stock inicial y al stock
 * actual del almacén (es decir, nunca recibieron movimientos). Cualquier caso
 * con desviaciones (ventas desde el PV, transferencias, ediciones) se reporta
 * como revisión manual y NO se toca.
 *
 * Uso:
 *   pnpm exec tsx scripts/ops/normalizar-stock-pv-duplicado.ts            # dry-run
 *   pnpm exec tsx scripts/ops/normalizar-stock-pv-duplicado.ts --apply    # aplica
 */
import { PrismaClient } from '../../src/generated/prisma';
import { pathToFileURL } from 'node:url';

/** Decisión de normalización por producto. */
export type StockPvDecision =
  | 'zero-pv' // duplicado intacto: es seguro poner el PV en 0
  | 'no-pv-row' // no existe fila de stock en el PV; nada que hacer
  | 'no-almacen-row' // sin fila de almacén: estado inesperado, revisar
  | 'manual-review'; // hubo movimientos posteriores: no tocar automáticamente

/**
 * @description Datos del estado de stock de un producto para evaluar su normalización.
 */
export interface StockPvEstado {
  /** Stock inicial del producto (campo legacy `producto.stock`, fijo tras creación). */
  stockProducto: number;
  /** Cantidad actual en la fila del almacén primario, o null si no existe. */
  almacenCantidad: number | null;
  /** Cantidad actual en la fila del punto de venta, o null si no existe. */
  pvCantidad: number | null;
  /** Cantidad reservada en la fila del punto de venta. */
  pvReservada: number;
}

/**
 * @description Decide si el stock de un punto de venta es el duplicado intacto
 * de la creación (se pone a 0) o requiere revisión manual.
 * La regla de seguridad: solo es seguro corregir cuando almacén y PV conservan
 * exactamente el stock inicial — cualquier movimiento posterior a la creación
 * (venta desde el PV, transferencia, edición) rompe esa igualdad y desactiva
 * el cambio automático.
 * @param {StockPvEstado} estado - Estado actual del stock del producto.
 * @returns {StockPvDecision} Acción decidida para el producto.
 */
export function decidirNormalizacionStockPv(estado: StockPvEstado): StockPvDecision {
  const { stockProducto, almacenCantidad, pvCantidad, pvReservada } = estado;

  if (pvCantidad === null) return 'no-pv-row';
  if (almacenCantidad === null) return 'no-almacen-row';

  const esDuplicadoIntacto =
    pvCantidad === stockProducto &&
    almacenCantidad === stockProducto &&
    pvReservada === 0;

  return esDuplicadoIntacto ? 'zero-pv' : 'manual-review';
}

interface ProductoConPv {
  id: string;
  nombre: string;
  stock: number;
  almacenId: string;
  puntoDeVentaId: string | null;
  tenantId: string;
}

interface ProductoReporte {
  productoId: string;
  tenantId: string;
  nombre: string;
  decision: StockPvDecision;
  detalle: string;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    const productos = (await prisma.producto.findMany({
      where: { puntoDeVentaId: { not: null } },
      select: {
        id: true,
        nombre: true,
        stock: true,
        almacenId: true,
        puntoDeVentaId: true,
        tenantId: true,
      },
    })) as ProductoConPv[];

    const reporte: ProductoReporte[] = [];

    for (const producto of productos) {
      const [almacenRow, pvRow] = await Promise.all([
        prisma.stockUbicacion.findUnique({
          where: {
            productoId_tipoUbicacion_ubicacionId: {
              productoId: producto.id,
              tipoUbicacion: 'almacen',
              ubicacionId: producto.almacenId,
            },
          },
          select: { cantidad: true },
        }),
        prisma.stockUbicacion.findUnique({
          where: {
            productoId_tipoUbicacion_ubicacionId: {
              productoId: producto.id,
              tipoUbicacion: 'punto_venta',
              ubicacionId: producto.puntoDeVentaId!,
            },
          },
          select: { cantidad: true, cantidadReservada: true },
        }),
      ]);

      const decision = decidirNormalizacionStockPv({
        stockProducto: producto.stock,
        almacenCantidad: almacenRow?.cantidad ?? null,
        pvCantidad: pvRow?.cantidad ?? null,
        pvReservada: pvRow?.cantidadReservada ?? 0,
      });

      reporte.push({
        productoId: producto.id,
        tenantId: producto.tenantId,
        nombre: producto.nombre,
        decision,
        detalle: `stock=${producto.stock} almacen=${almacenRow?.cantidad ?? 'sin fila'} pv=${pvRow?.cantidad ?? 'sin fila'} reservadaPV=${pvRow?.cantidadReservada ?? 0}`,
      });
    }

    const aCorregir = reporte.filter((r) => r.decision === 'zero-pv');
    const revisionManual = reporte.filter((r) => r.decision === 'manual-review');

    console.log(`Productos con punto de venta asignado: ${productos.length}`);
    console.log(`Duplicados intactos a corregir (PV → 0): ${aCorregir.length}`);
    console.log(`Requieren revisión manual (NO se tocan): ${revisionManual.length}\n`);

    for (const entrada of reporte) {
      const marca =
        entrada.decision === 'zero-pv'
          ? '[CORREGIR]'
          : entrada.decision === 'manual-review'
            ? '[REFIERE-REVISION]'
            : '[sin cambio]';
      console.log(
        `${marca} ${entrada.nombre} (tenant ${entrada.tenantId}, producto ${entrada.productoId}) — ${entrada.detalle}`,
      );
    }

    if (revisionManual.length > 0) {
      console.log(
        '\nLos casos marcados REFIERE-REVISION tuvieron movimientos posteriores a su creación; decide caso a caso si el stock físico vive en el PV o en el almacén.',
      );
    }

    if (!apply) {
      console.log('\nDry-run: nada escrito. Re-ejecuta con --apply para normalizar los duplicados intactos.');
      return;
    }

    for (const entrada of aCorregir) {
      const producto = productos.find((p) => p.id === entrada.productoId)!;
      await prisma.stockUbicacion.update({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: producto.id,
            tipoUbicacion: 'punto_venta',
            ubicacionId: producto.puntoDeVentaId!,
          },
        },
        data: { cantidad: 0, cantidadDisponible: 0 },
      });
      console.log(`Aplicado: ${producto.nombre} (${producto.id}) — PV en 0`);
    }

    console.log(`\nFilas normalizadas: ${aCorregir.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryUrl && import.meta.url === entryUrl) {
  void main().catch((error) => {
    console.error('Error en la normalización de stock de puntos de venta:', error);
    process.exit(1);
  });
}
