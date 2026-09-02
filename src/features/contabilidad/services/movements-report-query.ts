import { Prisma } from '@/generated/prisma';

const MAX_PAGE_SIZE = 100;
export const MAX_EXPORT_SIZE = 10_000;
const DAY_MS = 86_400_000;

export interface MovementsReportQueryParams {
  tenantId: string;
  busqueda?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  cuentaId?: string | null;
  tipoMovimiento?: string | null;
  moneda?: string | null;
  page?: number;
  limit?: number;
  formato?: string | null;
  includeServicios?: boolean;
  includeTransfers?: boolean;
  includeAdjustments?: boolean;
  includeCapital?: boolean;
  includePrestamosCash?: boolean;
  includeDeudasCash?: boolean;
}

type MovementSource =
  | 'sales'
  | 'services'
  | 'expenses'
  | 'transfers'
  | 'adjustments'
  | 'capital'
  | 'debt';

const MOVEMENT_SOURCE_BY_TYPE: Readonly<Record<string, MovementSource>> = {
  venta: 'sales',
  prestamo_cash_pago: 'sales',
  prestamo_cash_desembolso: 'sales',
  deuda_cash_pago: 'sales',
  deuda_cash_desembolso: 'sales',
  servicio: 'services',
  gasto: 'expenses',
  salario: 'expenses',
  transferencia_salida: 'transfers',
  transferencia_entrada: 'transfers',
  ajuste_ingreso: 'adjustments',
  ajuste_egreso: 'adjustments',
  inyeccion_capital: 'capital',
  pago_deuda: 'debt',
};

/**
 * @description Convierte una fecha civil en un límite UTC validado.
 * @param {string} value - Fecha civil YYYY-MM-DD.
 * @param {string} field - Nombre del filtro para el mensaje de error.
 * @param {boolean} exclusiveEnd - Si debe devolver el comienzo del día siguiente.
 * @returns {Date} Límite UTC listo para parametrizar.
 */
function parseCivilDate(value: string, field: string, exclusiveEnd = false): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} debe tener formato YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} no es una fecha civil válida`);
  }

  return exclusiveEnd ? new Date(date.getTime() + DAY_MS) : date;
}

/**
 * @description Construye la rama normalizada de reconciliaciones de ventas.
 * @param {MovementsReportQueryParams} params - Filtros y capacidades del reporte.
 * @returns {Prisma.Sql} Rama SQL parametrizada.
 */
function buildSalesSource(params: MovementsReportQueryParams): Prisma.Sql {
  const loanPredicates: Prisma.Sql[] = [];
  if (params.includePrestamosCash === false) {
    loanPredicates.push(Prisma.sql`COALESCE(rv."tipoReconciliacion", '') NOT IN ('PRESTAMO_CASH', 'PRESTAMO_CASH_DESEMBOLSO')`);
  }
  if (params.includeDeudasCash === false) {
    loanPredicates.push(Prisma.sql`COALESCE(rv."tipoReconciliacion", '') NOT IN ('DEUDA_CASH', 'DEUDA_CASH_DESEMBOLSO')`);
  }
  const capabilitySql = loanPredicates.length
    ? Prisma.sql`AND ${Prisma.join(loanPredicates, ' AND ')}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT rv."reconciliacionId"::text AS id,
      CASE rv."tipoReconciliacion"
        WHEN 'PRESTAMO_CASH' THEN 'prestamo_cash_pago'
        WHEN 'PRESTAMO_CASH_DESEMBOLSO' THEN 'prestamo_cash_desembolso'
        WHEN 'DEUDA_CASH' THEN 'deuda_cash_pago'
        WHEN 'DEUDA_CASH_DESEMBOLSO' THEN 'deuda_cash_desembolso'
        ELSE 'venta'
      END::text AS tipo,
      rv."fechaReconciliacion" AS fecha,
      CASE WHEN rv."tipoReconciliacion" IN ('PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH_DESEMBOLSO')
        THEN -ABS(rv.monto) ELSE rv.monto END AS monto,
      COALESCE(rv.moneda, 'CUP')::text AS moneda,
      CASE WHEN rv."montoConvertido" IS NULL THEN NULL
        WHEN rv."tipoReconciliacion" IN ('PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH_DESEMBOLSO')
          THEN -ABS(rv."montoConvertido") ELSE rv."montoConvertido" END AS "montoConvertido",
      rv."tasaCambio" AS "tasaCambio",
      CASE
        WHEN rv."tipoReconciliacion" = 'PRESTAMO_CASH' THEN 'Cobro Prestamo Cash'
        WHEN rv."tipoReconciliacion" = 'PRESTAMO_CASH_DESEMBOLSO' THEN 'Desembolso Prestamo Cash'
        WHEN rv."tipoReconciliacion" = 'DEUDA_CASH' THEN 'Pago Deuda Cash'
        WHEN rv."tipoReconciliacion" = 'DEUDA_CASH_DESEMBOLSO' THEN 'Desembolso de Deuda Cash'
        WHEN rv."ventaId" IS NOT NULL THEN 'Venta ' || rv."ventaId"
        ELSE 'Cobro ' || rv."reconciliacionId"
      END::text AS descripcion,
      rv."cuentaId"::text AS "cuentaId",
      (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text AS cuenta,
      tp.nombre::text AS "tipoPago", rv.observaciones::text, rv."reconciliadoPor"::text AS "realizadoPor",
      COALESCE(rv."ventaId", rv."prestamoCashId", rv."deudaCashId", rv."reconciliacionId")::text AS referencia,
      jsonb_build_object('tipoReconciliacion', rv."tipoReconciliacion") AS detalles,
      TRUE AS "coverageEligible",
      (UPPER(COALESCE(rv.moneda, 'CUP')) <> 'CUP' AND rv."montoConvertido" IS NOT NULL
        AND rv."rateEffectiveAt" IS NULL) AS "legacyUnproven",
      (UPPER(COALESCE(rv.moneda, 'CUP')) <> 'CUP' AND rv."montoConvertido" IS NULL) AS unresolved
    FROM "ReconciliacionVenta" rv
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = rv."cuentaId" AND cb."tenantId" = rv."tenantId"
    JOIN "TipoPago" tp ON tp."tipoId" = rv."tipoPagoId" AND tp."tenantId" = rv."tenantId"
    WHERE rv."tenantId" = ${params.tenantId} ${capabilitySql}`;
}

/** @description Construye movimientos de servicios. @param params - Contexto tenant. @returns Rama SQL. */
function buildServicesSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT rs."reconciliacionId"::text AS id, 'servicio'::text AS tipo,
      rs."fechaReconciliacion" AS fecha, rs.monto, COALESCE(rs.moneda, 'CUP')::text AS moneda,
      rs."montoConvertido", rs."tasaCambio", ('Servicio ' || rs."ventaServicioId")::text AS descripcion,
      rs."cuentaId"::text AS "cuentaId", (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text AS cuenta,
      tp.nombre::text AS "tipoPago", rs.observaciones::text, rs."reconciliadoPor"::text AS "realizadoPor",
      rs."ventaServicioId"::text AS referencia, '{}'::jsonb AS detalles,
      TRUE AS "coverageEligible",
      (UPPER(COALESCE(rs.moneda, 'CUP')) <> 'CUP' AND rs."montoConvertido" IS NOT NULL
        AND rs."rateEffectiveAt" IS NULL) AS "legacyUnproven",
      (UPPER(COALESCE(rs.moneda, 'CUP')) <> 'CUP' AND rs."montoConvertido" IS NULL) AS unresolved
    FROM "ReconciliacionServicio" rs
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = rs."cuentaId" AND cb."tenantId" = rs."tenantId"
    JOIN "TipoPago" tp ON tp."tipoId" = rs."tipoPagoId" AND tp."tenantId" = rs."tenantId"
    WHERE rs."tenantId" = ${params.tenantId}`;
}

/** @description Construye gastos reconocidos y salarios. @param params - Contexto tenant. @returns Rama SQL. */
function buildExpensesSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT rg."reconciliacionId"::text AS id,
      CASE WHEN LOWER(rg."tipoGasto") = 'salario' THEN 'salario' ELSE 'gasto' END::text AS tipo,
      rg."fechaReconciliacion" AS fecha, -rg.monto AS monto, COALESCE(rg.moneda, 'CUP')::text AS moneda,
      CASE WHEN rg."montoConvertido" IS NULL THEN NULL ELSE -rg."montoConvertido" END AS "montoConvertido",
      rg."tasaCambio", rg.descripcion::text, rg."cuentaId"::text AS "cuentaId",
      (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text AS cuenta, tp.nombre::text AS "tipoPago",
      rg.observaciones::text, rg."reconciliadoPor"::text AS "realizadoPor", rg."reconciliacionId"::text AS referencia,
      jsonb_build_object('periodo', rg.periodo) AS detalles,
      TRUE AS "coverageEligible",
      (UPPER(COALESCE(rg.moneda, 'CUP')) <> 'CUP' AND rg."montoConvertido" IS NOT NULL
        AND rg."rateEffectiveAt" IS NULL) AS "legacyUnproven",
      (UPPER(COALESCE(rg.moneda, 'CUP')) <> 'CUP' AND rg."montoConvertido" IS NULL) AS unresolved
    FROM "ReconciliacionGasto" rg
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = rg."cuentaId" AND cb."tenantId" = rg."tenantId"
    JOIN "TipoPago" tp ON tp."tipoId" = rg."tipoPagoId" AND tp."tenantId" = rg."tenantId"
    WHERE rg."tenantId" = ${params.tenantId}
      AND UPPER(COALESCE(rg.estado, 'PAGADA')) NOT IN ('PENDIENTE', 'ANULADA', 'CANCELADA')`;
}

/** @description Construye ambas patas contables de las transferencias. @param params - Contexto tenant. @returns Ramas SQL. */
function buildTransfersSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT (tb."transferenciaId" || '-origen')::text AS id, 'transferencia_salida'::text AS tipo,
      tb."fechaTransferencia" AS fecha, -tb."montoOrigen" AS monto, COALESCE(tb."monedaOrigen", 'CUP')::text AS moneda,
      NULL::numeric AS "montoConvertido", tb."tasaCambio", ('Transf a ' || destino."nombreBanco")::text AS descripcion,
      tb."cuentaOrigenId"::text AS "cuentaId", (origen."nombreBanco" || ' - ' || origen."numeroCuenta")::text AS cuenta,
      'Transferencia'::text AS "tipoPago", tb.descripcion::text AS observaciones, 'Sistema'::text AS "realizadoPor",
      tb."numeroComprobante"::text AS referencia, jsonb_build_object('motivo', tb.motivo) AS detalles,
      FALSE AS "coverageEligible", FALSE AS "legacyUnproven", FALSE AS unresolved
    FROM "TransferenciaBancaria" tb
    JOIN "CuentaBancaria" origen ON origen."cuentaId" = tb."cuentaOrigenId" AND origen."tenantId" = tb."tenantId"
    JOIN "CuentaBancaria" destino ON destino."cuentaId" = tb."cuentaDestinoId" AND destino."tenantId" = tb."tenantId"
    WHERE tb."tenantId" = ${params.tenantId}
    UNION ALL
    SELECT (tb."transferenciaId" || '-destino')::text, 'transferencia_entrada'::text,
      tb."fechaTransferencia", tb."montoDestino", COALESCE(tb."monedaDestino", 'CUP')::text,
      NULL::numeric, tb."tasaCambio", ('Transf desde ' || origen."nombreBanco")::text,
      tb."cuentaDestinoId"::text, (destino."nombreBanco" || ' - ' || destino."numeroCuenta")::text,
      'Transferencia'::text, tb.descripcion::text, 'Sistema'::text, tb."numeroComprobante"::text,
      jsonb_build_object('motivo', tb.motivo), FALSE, FALSE, FALSE
    FROM "TransferenciaBancaria" tb
    JOIN "CuentaBancaria" origen ON origen."cuentaId" = tb."cuentaOrigenId" AND origen."tenantId" = tb."tenantId"
    JOIN "CuentaBancaria" destino ON destino."cuentaId" = tb."cuentaDestinoId" AND destino."tenantId" = tb."tenantId"
    WHERE tb."tenantId" = ${params.tenantId}`;
}

/** @description Construye ajustes bancarios con signo contable. @param params - Contexto tenant. @returns Rama SQL. */
function buildAdjustmentsSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT ab."ajusteId"::text AS id,
      CASE WHEN ab.tipo = 'ingreso' THEN 'ajuste_ingreso' ELSE 'ajuste_egreso' END::text AS tipo,
      ab."fechaOperacion" AS fecha, CASE WHEN ab.tipo = 'ingreso' THEN ab.monto ELSE -ab.monto END AS monto,
      COALESCE(ab.moneda, 'CUP')::text AS moneda,
      CASE WHEN ab."montoConvertido" IS NULL THEN NULL WHEN ab.tipo = 'ingreso' THEN ab."montoConvertido" ELSE -ab."montoConvertido" END,
      ab."tasaCambio", ab.descripcion::text, ab."cuentaId"::text,
      (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text,
      CASE WHEN ab.tipo = 'ingreso' THEN 'Ajuste Ingreso' ELSE 'Ajuste Egreso' END::text,
      ab.motivo::text, ab."realizadoPor"::text, ab."ajusteId"::text,
      jsonb_build_object('tipoAjuste', ab.tipo, 'motivo', ab.motivo), FALSE, FALSE, FALSE
    FROM "AjusteBancario" ab
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = ab."cuentaId" AND cb."tenantId" = ab."tenantId"
    WHERE ab."tenantId" = ${params.tenantId}`;
}

/** @description Construye aportes de capital y deuda externa. @param params - Contexto tenant. @returns Rama SQL. */
function buildCapitalSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT ic.id::text, 'inyeccion_capital'::text, ic."createdAt", ic."montoRecibido", COALESCE(ic.moneda, 'CUP')::text,
      NULL::numeric, NULL::numeric,
      CASE WHEN ic.tipo::text = 'CAPITAL_SOCIAL' THEN 'Aportación Capital: ' || COALESCE(ic.socio, '')
        ELSE 'Préstamo: ' || COALESCE(ic."entidadPrestamista", '') END::text,
      ic."cuentaId"::text, (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text,
      CASE WHEN ic.tipo::text = 'CAPITAL_SOCIAL' THEN 'Capital Social' ELSE 'Deuda Externa' END::text,
      ic.descripcion::text, 'Sistema'::text, ic.id::text,
      jsonb_build_object('tipoInyeccion', ic.tipo, 'entidad', CASE WHEN ic.tipo::text = 'CAPITAL_SOCIAL' THEN ic.socio ELSE ic."entidadPrestamista" END),
      FALSE, FALSE, FALSE
    FROM "InyeccionCapital" ic
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = ic."cuentaId"
    WHERE cb."tenantId" = ${params.tenantId}`;
}

/** @description Construye pagos de deuda externa. @param params - Contexto tenant. @returns Rama SQL. */
function buildDebtSource(params: MovementsReportQueryParams): Prisma.Sql {
  return Prisma.sql`
    SELECT pd.id::text, 'pago_deuda'::text, pd."fechaPago", -pd."montoPagado", COALESCE(cb.moneda, 'CUP')::text,
      NULL::numeric, NULL::numeric, ('Pago Deuda: ' || COALESCE(ic."entidadPrestamista", ''))::text,
      pd."cuentaId"::text, (cb."nombreBanco" || ' - ' || cb."numeroCuenta")::text,
      'Pago Deuda'::text, pd.observaciones::text, 'Sistema'::text, COALESCE(pd.comprobante, pd.id)::text,
      jsonb_build_object('comprobante', pd.comprobante), FALSE, FALSE, FALSE
    FROM "PagoDeuda" pd
    JOIN "CuentaBancaria" cb ON cb."cuentaId" = pd."cuentaId"
    JOIN "InyeccionCapital" ic ON ic.id = pd."inyeccionId"
    WHERE cb."tenantId" = ${params.tenantId}`;
}

/**
 * @description Construye un único query PostgreSQL parametrizado para filtrar, agregar y paginar movimientos.
 * @param {MovementsReportQueryParams} params - Tenant, filtros, paginación y capacidades habilitadas.
 * @returns {Prisma.Sql} Consulta lista para ejecutar mediante prisma.$queryRaw.
 */
export function buildMovementsReportQuery(params: MovementsReportQueryParams): Prisma.Sql {
  if (!params.tenantId.trim()) throw new Error('tenantId es obligatorio');

  const requestedType = params.tipoMovimiento && params.tipoMovimiento !== 'all'
    ? params.tipoMovimiento
    : null;
  const selectedSource = requestedType ? MOVEMENT_SOURCE_BY_TYPE[requestedType] ?? null : null;
  const shouldUse = (source: MovementSource, enabled = true) =>
    enabled && (selectedSource === null || selectedSource === source);

  const sources: Prisma.Sql[] = [];
  if (shouldUse('sales')) sources.push(buildSalesSource(params));
  if (shouldUse('services', params.includeServicios !== false)) sources.push(buildServicesSource(params));
  if (shouldUse('expenses')) sources.push(buildExpensesSource(params));
  if (shouldUse('transfers', params.includeTransfers !== false)) sources.push(buildTransfersSource(params));
  if (shouldUse('adjustments', params.includeAdjustments !== false)) sources.push(buildAdjustmentsSource(params));
  if (shouldUse('capital', params.includeCapital !== false)) sources.push(buildCapitalSource(params));
  if (shouldUse('debt', params.includeDeudasCash !== false)) sources.push(buildDebtSource(params));

  const emptySource = Prisma.sql`
    SELECT NULL::text AS id, NULL::text AS tipo, NULL::timestamp AS fecha, NULL::numeric AS monto,
      NULL::text AS moneda, NULL::numeric AS "montoConvertido", NULL::numeric AS "tasaCambio",
      NULL::text AS descripcion, NULL::text AS "cuentaId", NULL::text AS cuenta, NULL::text AS "tipoPago",
      NULL::text AS observaciones, NULL::text AS "realizadoPor", NULL::text AS referencia,
      '{}'::jsonb AS detalles, FALSE AS "coverageEligible", FALSE AS "legacyUnproven",
      FALSE AS unresolved WHERE FALSE`;
  const normalizedSql = sources.length ? Prisma.join(sources, ' UNION ALL ') : emptySource;

  const predicates: Prisma.Sql[] = [];
  if (params.fechaInicio) predicates.push(Prisma.sql`fecha >= ${parseCivilDate(params.fechaInicio, 'fechaInicio')}`);
  if (params.fechaFin) predicates.push(Prisma.sql`fecha < ${parseCivilDate(params.fechaFin, 'fechaFin', true)}`);
  if (params.cuentaId) predicates.push(Prisma.sql`"cuentaId" = ${params.cuentaId}`);
  if (params.moneda) predicates.push(Prisma.sql`moneda = ${params.moneda}`);
  if (requestedType) predicates.push(Prisma.sql`tipo = ${requestedType}`);
  if (params.busqueda?.trim()) {
    const search = `%${params.busqueda.trim()}%`;
    predicates.push(Prisma.sql`(
      descripcion ILIKE ${search} OR referencia ILIKE ${search} OR observaciones ILIKE ${search}
    )`);
  }
  const whereSql = predicates.length
    ? Prisma.sql`WHERE ${Prisma.join(predicates, ' AND ')}`
    : Prisma.empty;

  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const isExport = params.formato === 'csv' || params.formato === 'pdf';
  const maxPageSize = isExport ? MAX_EXPORT_SIZE : MAX_PAGE_SIZE;
  const limit = Math.min(maxPageSize, Math.max(1, Math.trunc(params.limit ?? (isExport ? MAX_EXPORT_SIZE : 10))));
  const offset = (page - 1) * limit;

  return Prisma.sql`
    WITH normalized AS (${normalizedSql}),
    filtered AS (SELECT * FROM normalized ${whereSql}),
    totals_by_currency AS (
      SELECT moneda,
        COALESCE(SUM(CASE WHEN monto > 0 THEN monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN monto < 0 THEN ABS(monto) ELSE 0 END), 0) AS egresos,
        COALESCE(SUM(monto), 0) AS neto
      FROM filtered
      GROUP BY moneda
    ),
    conversion_coverage AS (
      SELECT COUNT(*)::integer AS total,
        (COUNT(*) - COUNT(*) FILTER (WHERE "legacyUnproven")
          - COUNT(*) FILTER (WHERE unresolved))::integer AS normalized,
        COUNT(*) FILTER (WHERE "legacyUnproven")::integer AS "legacyUnproven",
        COUNT(*) FILTER (WHERE unresolved)::integer AS unresolved
      FROM filtered
      WHERE "coverageEligible"
    ),
    paged AS (
      SELECT * FROM filtered ORDER BY fecha DESC, id DESC LIMIT ${limit} OFFSET ${offset}
    )
    SELECT
      COALESCE((SELECT jsonb_agg(
        (to_jsonb(paged) - 'coverageEligible' - 'legacyUnproven' - 'unresolved')
          || jsonb_build_object('fecha', to_char(paged.fecha, 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))
        ORDER BY fecha DESC, id DESC
      ) FROM paged), '[]'::jsonb) AS data,
      (SELECT COUNT(*)::integer FROM filtered) AS total,
      COALESCE((SELECT jsonb_object_agg(moneda, jsonb_build_object(
        'ingresos', ingresos, 'egresos', egresos, 'neto', neto
      )) FROM totals_by_currency), '{}'::jsonb) AS totales,
      (SELECT jsonb_build_object(
        'total', total,
        'normalized', normalized,
        'legacyUnproven', "legacyUnproven",
        'unresolved', unresolved,
        'percentage', CASE WHEN total = 0 THEN 100
          ELSE ROUND((normalized::numeric / total::numeric) * 100, 2) END
      ) FROM conversion_coverage) AS "coberturaConversion"`;
}
