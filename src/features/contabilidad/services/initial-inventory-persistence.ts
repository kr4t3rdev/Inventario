import { createHash } from 'node:crypto';

import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

import {
  initialInventoryContract,
  type InitialInventoryData,
  type InitialInventoryRow,
} from './initial-inventory-contract';

type Transaction = Prisma.TransactionClient;

interface PersistInitialInventoryInput extends InitialInventoryData {
  tenantId: string;
  inicializacionId: string;
}

function parseCutoffDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function buildEvidence(input: {
  row: InitialInventoryRow;
  fechaCorte: string;
  monedaFuncional: string;
  montoFuncional: Prisma.Decimal;
  tasaCambio: Prisma.Decimal | null;
}): { evidence: Record<string, string | null>; hash: string } {
  const evidence = {
    version: '1',
    source: 'INICIALIZACION_CONTABLE',
    referenciaFila: input.row.referenciaFila,
    fechaCorte: input.fechaCorte,
    monedaOriginal: input.row.moneda,
    monedaFuncional: input.monedaFuncional,
    cantidad: input.row.cantidad,
    costoUnitario: input.row.costoUnitario,
    montoFuncional: input.montoFuncional.toFixed(4),
    tasaCambio: input.tasaCambio?.toFixed(8) ?? null,
  };
  const hash = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  return { evidence, hash };
}

function functionalValue(
  row: InitialInventoryRow,
  monedaFuncional: string,
  tasas: Record<string, string> | undefined,
): { amount: Prisma.Decimal; rate: Prisma.Decimal | null } {
  const original = new Prisma.Decimal(row.cantidad).times(row.costoUnitario);
  if (row.moneda === monedaFuncional) {
    return { amount: original.toDecimalPlaces(4), rate: null };
  }
  const rawRate = row.tasaCambio ?? tasas?.[row.moneda];
  if (!rawRate) {
    throw new ActionError(
      `Falta la tasa de cambio para valorar el inventario en ${row.moneda}`,
      'INITIALIZATION_FX_REQUIRED',
    );
  }
  const rate = new Prisma.Decimal(rawRate);
  return { amount: original.times(rate).toDecimalPlaces(4), rate };
}

async function validateReferences(
  tx: Transaction,
  tenantId: string,
  row: InitialInventoryRow,
): Promise<void> {
  const product = await tx.producto.findFirst({
    where: { id: row.productoId, tenantId },
    select: { id: true },
  });
  if (!product) {
    throw new ActionError('El producto no pertenece a la empresa', 'INITIALIZATION_PRODUCT_INVALID');
  }

  const warehouse = await tx.almacen.findFirst({
    where: { almacenId: row.almacenId, tenantId },
    select: { almacenId: true },
  });
  if (!warehouse) {
    throw new ActionError('El almacén no pertenece a la empresa', 'INITIALIZATION_WAREHOUSE_INVALID');
  }

  if (row.ubicacionId) {
    const location = await tx.ubicacion.findFirst({
      where: { id: row.ubicacionId, almacenId: row.almacenId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new ActionError('La ubicación no pertenece al almacén', 'INITIALIZATION_LOCATION_INVALID');
    }
  }
}

/**
 * @description Persiste existencias iniciales como lotes propios, stock por
 * almacén y fuentes FIFO. Nunca crea compras, recepciones ni gastos.
 * @param tx - Transacción coordinada de la inicialización.
 * @param input - Tenant, inicialización activa y existencias declaradas.
 * @returns Cantidad de filas persistidas y sus fuentes verificables.
 */
export async function persistInitialInventory(
  tx: Transaction,
  input: PersistInitialInventoryInput,
): Promise<{
  count: number;
  totalFuncional: string;
  fuentes: Array<{ referenciaFila: string; fuenteId: string; loteId: string }>;
  filas: Array<{ referenciaFila: string; moneda: string; montoFuncional: string }>;
}> {
  const parsed = initialInventoryContract.parse({
    fechaCorte: input.fechaCorte,
    monedaFuncional: input.monedaFuncional,
    tasas: input.tasas,
    inventario: input.inventario,
  });
  const initialization = await tx.inicializacionContable.findFirst({
    where: {
      inicializacionId: input.inicializacionId,
      tenantId: input.tenantId,
      estado: 'EN_PROGRESO',
    },
    select: { inicializacionId: true },
  });
  if (!initialization) {
    throw new ActionError('La inicialización no está activa', 'INITIALIZATION_INCOMPLETE');
  }

  let totalFuncional = new Prisma.Decimal(0);
  const fuentes: Array<{ referenciaFila: string; fuenteId: string; loteId: string }> = [];
  const filas: Array<{ referenciaFila: string; moneda: string; montoFuncional: string }> = [];
  for (const row of parsed.inventario) {
    await validateReferences(tx, input.tenantId, row);
    const valued = functionalValue(row, parsed.monedaFuncional, parsed.tasas);
    const fechaCorte = parseCutoffDate(parsed.fechaCorte);
    const { evidence, hash } = buildEvidence({
      row,
      fechaCorte: parsed.fechaCorte,
      monedaFuncional: parsed.monedaFuncional,
      montoFuncional: valued.amount,
      tasaCambio: valued.rate,
    });
    const lote = await tx.lote.create({
      data: {
        tenantId: input.tenantId,
        productoId: row.productoId,
        codigo: row.loteCodigo,
        fechaVencimiento: row.fechaVencimiento ? parseCutoffDate(row.fechaVencimiento) : null,
        cantidadInicial: Number(row.cantidad),
        cantidadDisponible: Number(row.cantidad),
        compraItemId: null,
        recepcionItemId: null,
        createdAt: fechaCorte,
      },
      select: { id: true },
    });

    await upsertStockUbicacion(tx, {
      tenantId: input.tenantId,
      productoId: row.productoId,
      tipoUbicacion: 'almacen',
      ubicacionId: row.almacenId,
      ubicacionHijaId: row.ubicacionId,
      modo: 'increment',
      delta: Number(row.cantidad),
    });
    await tx.producto.update({
      where: { id: row.productoId },
      data: { stock: { increment: Number(row.cantidad) } },
    });

    const source = await tx.inventarioInicialFuente.create({
      data: {
        tenantId: input.tenantId,
        inicializacionId: input.inicializacionId,
        loteId: lote.id,
        productoId: row.productoId,
        cantidad: Number(row.cantidad),
        costoUnitario: new Prisma.Decimal(row.costoUnitario),
        moneda: row.moneda,
        fechaCorte,
        montoFuncional: valued.amount,
        monedaFuncional: parsed.monedaFuncional,
        evidencia: evidence,
        evidenciaHash: hash,
      },
      select: { id: true, loteId: true },
    });
    totalFuncional = totalFuncional.plus(valued.amount);
    fuentes.push({
      referenciaFila: row.referenciaFila,
      fuenteId: source.id,
      loteId: source.loteId,
    });
    filas.push({
      referenciaFila: row.referenciaFila,
      moneda: row.moneda,
      montoFuncional: valued.amount.toFixed(4),
    });
  }

  return {
    count: fuentes.length,
    totalFuncional: totalFuncional.toFixed(4),
    fuentes,
    filas,
  };
}
