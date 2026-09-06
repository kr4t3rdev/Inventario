import { ActionError } from '@/lib/server-actions/types';

export const MOTIVOS_AJUSTE_DEFAULT = 'PERDIDA' as const;

/**
 * @description Mapea un motivo libre legacy (merma) al catálogo de ajustes.
 * @param {string | null | undefined} motivo - Texto libre del documento legacy.
 * @returns {string} Motivo del catálogo (default PERDIDA).
 */
export function mapearMotivoLegacy(motivo: string | null | undefined): string {
  if (!motivo) return MOTIVOS_AJUSTE_DEFAULT;
  const texto = motivo.toUpperCase();
  if (/DAÑ|DANO/.test(texto)) return 'DANO';
  if (/CADUC|VENC|EXPIR/.test(texto)) return 'CADUCIDAD';
  if (/SOBRANTE|EXCEDENTE/.test(texto)) return 'SOBRANTE';
  if (/CONSUMO|INTERNO/.test(texto)) return 'CONSUMO_INTERNO';
  if (/CONTEO|RECUENTO/.test(texto)) return 'ERROR_CONTEO';
  return MOTIVOS_AJUSTE_DEFAULT;
}

export const TIPOS_MOVIMIENTO_INVENTARIO = [
  'VENTA',
  'COMPRA',
  'TRANSFERENCIA',
  'MERMA',
  'AJUSTE',
  'PRODUCCION',
  'CONTEO',
] as const;

export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

export const KARDEX_LIMIT_DEFAULT = 100;
export const KARDEX_LIMIT_MAX = 500;

export interface RegistrarMovimientoInput {
  tenantId: string;
  productoId: string;
  tipoOrigen: TipoMovimientoInventario;
  origenId: string;
  tipoUbicacion: string;
  ubicacionId: string;
  cantidad: number;
  costoUnitario: number;
  /**
   * Discriminador dentro del mismo documento origen. Ej.: 'SALIDA'/'ENTRADA'
   * para transferencias, 'ITEM-<n>' para ítems, 'REV-*' para compensaciones.
   * La escritura es idempotente por (tenant, origen, producto, ubicación, secuencia).
   */
  secuencia?: string;
  creadoPorId?: string;
}

export interface FiltrosKardex {
  tenantId: string;
  /** Requerido: el saldo solo tiene sentido dentro de un producto. */
  productoId: string;
  tipoUbicacion?: string;
  ubicacionId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  page?: number;
  limit?: number;
}

export interface FiltrosOrigen {
  tenantId: string;
  tipoOrigen: TipoMovimientoInventario;
  origenId: string;
}

export interface MovimientoKardex {
  id: string;
  tenantId: string;
  productoId: string;
  tipoOrigen: TipoMovimientoInventario;
  origenId: string;
  tipoUbicacion: string;
  ubicacionId: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  secuencia: string;
  createdAt: Date;
  creadoPorId?: string | null;
}

export interface MovimientoKardexConSaldo extends MovimientoKardex {
  saldo: number;
}

export interface KardexResult {
  items: MovimientoKardexConSaldo[];
  saldoInicial: number;
  total: number;
  page: number;
  limit: number;
}

interface EventoKeyInput {
  tenantId: string;
  tipoOrigen: TipoMovimientoInventario;
  origenId: string;
  productoId: string;
  tipoUbicacion: string;
  ubicacionId: string;
  secuencia: string;
}

export interface StockMoveLineStore {
  stockMoveLine: {
    upsert(args: {
      where: { eventoKey: EventoKeyInput };
      create: Omit<RegistrarMovimientoInput, 'secuencia'> & {
        productoTenantId: string;
        costoTotal: number;
        secuencia: string;
      };
      update: Record<string, never>;
    }): Promise<MovimientoKardex>;
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, 'asc' | 'desc'>>;
      skip?: number;
      take?: number;
    }): Promise<MovimientoKardex[]>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
    aggregate(args: {
      where: Record<string, unknown>;
      _sum: { cantidad: true };
    }): Promise<{ _sum: { cantidad: number | null } }>;
  };
}

/**
 * @description Registra una entrada o salida del kardex de forma idempotente.
 * La clave de evento (tenant + origen + producto + ubicación + secuencia)
 * hace que un retry del mismo evento devuelva la fila existente sin duplicar.
 * @param {StockMoveLineStore} tx - Cliente Prisma directo o transaccional.
 * @param {RegistrarMovimientoInput} input - Datos del movimiento en unidad stock.
 * @returns {Promise<MovimientoKardex>} Movimiento persistido (o existente).
 */
export async function registrarMovimiento(
  tx: StockMoveLineStore,
  input: RegistrarMovimientoInput,
): Promise<MovimientoKardex> {
  if (!Number.isSafeInteger(input.cantidad) || input.cantidad === 0) {
    throw new ActionError(
      'La cantidad del movimiento debe ser distinta de cero',
      'CANTIDAD_MOVIMIENTO_INVALIDA',
    );
  }

  if (!Number.isSafeInteger(input.costoUnitario) || input.costoUnitario < 0) {
    throw new ActionError(
      'El costo unitario del movimiento no es válido',
      'COSTO_MOVIMIENTO_INVALIDO',
    );
  }

  const secuencia = input.secuencia ?? '0';

  return tx.stockMoveLine.upsert({
    where: {
      eventoKey: {
        tenantId: input.tenantId,
        tipoOrigen: input.tipoOrigen,
        origenId: input.origenId,
        productoId: input.productoId,
        tipoUbicacion: input.tipoUbicacion,
        ubicacionId: input.ubicacionId,
        secuencia,
      },
    },
    create: {
      tenantId: input.tenantId,
      productoTenantId: input.tenantId,
      productoId: input.productoId,
      tipoOrigen: input.tipoOrigen,
      origenId: input.origenId,
      tipoUbicacion: input.tipoUbicacion,
      ubicacionId: input.ubicacionId,
      cantidad: input.cantidad,
      costoUnitario: input.costoUnitario,
      costoTotal: input.cantidad * input.costoUnitario,
      secuencia,
      creadoPorId: input.creadoPorId,
    },
    update: {},
  });
}

/**
 * @description Consulta el kardex de un producto con saldo acumulado correcto.
 * Calcula el saldo de apertura (suma previa a `fechaDesde`) y pagina los
 * movimientos para no cargar el historial completo en memoria.
 * @param {StockMoveLineStore} tx - Cliente Prisma directo o transaccional.
 * @param {FiltrosKardex} filtros - Filtros; `productoId` es obligatorio.
 * @returns {Promise<KardexResult>} Movimientos con saldo, saldo inicial y total.
 */
export async function getKardex(
  tx: StockMoveLineStore,
  filtros: FiltrosKardex,
): Promise<KardexResult> {
  if (!filtros.productoId) {
    throw new ActionError(
      'El kardex requiere un producto específico para calcular el saldo',
      'KARDEX_SIN_PRODUCTO',
    );
  }

  const where: Record<string, unknown> = {
    tenantId: filtros.tenantId,
    productoId: filtros.productoId,
  };

  if (filtros.tipoUbicacion) where.tipoUbicacion = filtros.tipoUbicacion;
  if (filtros.ubicacionId) where.ubicacionId = filtros.ubicacionId;
  if (filtros.fechaDesde || filtros.fechaHasta) {
    where.createdAt = {
      ...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
      ...(filtros.fechaHasta ? { lt: filtros.fechaHasta } : {}),
    };
  }

  let saldoInicial = 0;
  if (filtros.fechaDesde) {
    const apertura = await tx.stockMoveLine.aggregate({
      where: {
        tenantId: filtros.tenantId,
        productoId: filtros.productoId,
        ...(filtros.tipoUbicacion ? { tipoUbicacion: filtros.tipoUbicacion } : {}),
        ...(filtros.ubicacionId ? { ubicacionId: filtros.ubicacionId } : {}),
        createdAt: { lt: filtros.fechaDesde },
      },
      _sum: { cantidad: true },
    });
    saldoInicial = apertura._sum.cantidad ?? 0;
  }

  const page = Math.max(1, filtros.page ?? 1);
  const limit = Math.min(KARDEX_LIMIT_MAX, Math.max(1, filtros.limit ?? KARDEX_LIMIT_DEFAULT));

  const [movimientos, total] = await Promise.all([
    tx.stockMoveLine.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    tx.stockMoveLine.count({ where }),
  ]);

  let saldo = saldoInicial;
  if (page > 1 && movimientos.length > 0) {
    // Saldo al inicio de la página: suma de lo anterior al primer movimiento
    // de la página (más el corte de fechaDesde, si aplica). Las páginas se
    // ordenan por (createdAt, id), por lo que este agregado es estable salvo
    // empates exactos de timestamp en el borde de página.
    const primerMovimiento = movimientos[0];
    const aperturaPagina = await tx.stockMoveLine.aggregate({
      where: {
        tenantId: filtros.tenantId,
        productoId: filtros.productoId,
        ...(filtros.tipoUbicacion ? { tipoUbicacion: filtros.tipoUbicacion } : {}),
        ...(filtros.ubicacionId ? { ubicacionId: filtros.ubicacionId } : {}),
        createdAt: {
          ...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
          lt: primerMovimiento.createdAt,
        },
      },
      _sum: { cantidad: true },
    });
    saldo = saldoInicial + (aperturaPagina._sum.cantidad ?? 0);
  } else if (!filtros.fechaDesde) {
    saldo = 0;
  }

  return {
    items: movimientos.map((movimiento) => {
      saldo += movimiento.cantidad;
      return { ...movimiento, saldo };
    }),
    saldoInicial,
    total,
    page,
    limit,
  };
}

/**
 * @description Introduce una compensación en el kardex (mismas cantidades con
 * signo invertido) usando el espacio de secuencia `REV-` de la secuencia base.
 * Nunca edita el movimiento original.
 * @param {StockMoveLineStore} tx - Cliente Prisma directo o transaccional.
 * @param {RegistrarMovimientoInput} original - Movimiento original a revertir.
 * @param {string} [etiqueta] - Prefijo de secuencia compensatoria (default 'REV').
 */
export async function revertirMovimientoKardex(
  tx: StockMoveLineStore,
  original: RegistrarMovimientoInput,
  etiqueta = 'REV',
): Promise<MovimientoKardex> {
  return registrarMovimiento(tx, {
    ...original,
    cantidad: -original.cantidad,
    secuencia: `${etiqueta}-${original.secuencia ?? '0'}`,
  });
}

/**
 * @description Lee las líneas existentes del kardex para un documento origen.
 * Base de las compensaciones de ciclo de vida (edición/eliminación) y de
 * reversiones con el costo histórico original.
 * @param {StockMoveLineStore} tx - Cliente Prisma directo o transaccional.
 * @param {FiltrosOrigen} filtros - Tenant, tipo de origen y documento.
 * @returns {Promise<MovimientoKardex[]>} Líneas del origen en orden cronológico.
 */
export async function getMovimientosDeOrigen(
  tx: StockMoveLineStore,
  filtros: FiltrosOrigen,
): Promise<MovimientoKardex[]> {
  return tx.stockMoveLine.findMany({
    where: {
      tenantId: filtros.tenantId,
      tipoOrigen: filtros.tipoOrigen,
      origenId: filtros.origenId,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/**
 * @description Revierte todas las líneas de un documento origen con el
 * costo histórico registrado, sin editar los movimientos originales.
 * Idempotente: repetir la reversión reutiliza la misma clave de evento.
 * @param {StockMoveLineStore} tx - Cliente Prisma directo o transaccional.
 * @param {FiltrosOrigen & { creadoPorId?: string }} filtros - Origen a revertir.
 * @returns {Promise<MovimientoKardex[]>} Líneas compensatorias registradas.
 */
export async function revertirMovimientosDeOrigen(
  tx: StockMoveLineStore,
  filtros: FiltrosOrigen & { creadoPorId?: string },
): Promise<MovimientoKardex[]> {
  const originales = await getMovimientosDeOrigen(tx, filtros);
  const compensadas: MovimientoKardex[] = [];

  for (const original of originales) {
    if (original.secuencia?.startsWith('REV-')) continue;
    compensadas.push(
      await revertirMovimientoKardex(
        tx,
        {
          tenantId: filtros.tenantId,
          productoId: original.productoId,
          tipoOrigen: filtros.tipoOrigen,
          origenId: filtros.origenId,
          tipoUbicacion: original.tipoUbicacion,
          ubicacionId: original.ubicacionId,
          cantidad: original.cantidad,
          costoUnitario: original.costoUnitario,
          secuencia: original.secuencia,
          creadoPorId: filtros.creadoPorId,
        },
        'REV',
      ),
    );
  }

  return compensadas;
}
