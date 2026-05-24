/**
 * @description Servicio para generar y verificar snapshots de saldos bancarios.
 *
 * Calcula los totales de ingresos/egresos/saldo por cuenta bancaria
 * usando agregaciones sobre las tablas de reconciliaciones, ajustes y transferencias.
 *
 * - Modo 'caja': filtra por fechaReconciliacion dentro del rango del período.
 * - Modo 'devengo': filtra por createdAt dentro del rango del período.
 */

import { prisma } from '@/lib/prisma';
import type { SaldoSnapshot, SnapshotPeriodo } from '@/generated/prisma';
import { SnapshotTotales } from './periodo-contable-types';
import { ENTIDADES_CAJA, ENTIDADES_DEVENGO } from './fecha-operacion-registry';

/**
 * @description Servicio de snapshot de saldos bancarios.
 */
export class SnapshotService {
  /**
   * Genera un snapshot de saldos para el período dado.
   *
   * Calcula el saldo neto de cada cuenta bancaria activa del tenant
   * sumando reconciliaciones de ventas, servicios, gastos, ajustes
   * y transferencias dentro del rango del período.
   *
   * @param {string} periodoId - ID del período contable.
   * @param {'caja' | 'devengo'} tipo - Tipo de base contable.
   * @param {string} actor - ID del usuario que genera el snapshot.
   * @returns {Promise<SaldoSnapshot[]>} Array de snapshots creados (uno por cuenta).
   */
  async generarSnapshot(
    periodoId: string,
    tipo: 'caja' | 'devengo',
    actor: string,
  ): Promise<SaldoSnapshot[]> {
    // Obtener el período para conocer tenantId y rango de fechas
    const periodo = await prisma.periodoContable.findUnique({
      where: { periodoId },
    });

    if (!periodo) {
      throw new Error(`Período no encontrado: ${periodoId}`);
    }

    // Obtener todas las cuentas bancarias activas del tenant
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: {
        tenantId: periodo.tenantId,
        isActive: true,
      },
    });

    const field = tipo === 'caja' ? 'fechaReconciliacion' : 'createdAt';
    const dateFilter =
      tipo === 'caja'
        ? { fechaReconciliacion: { gte: periodo.fechaInicio, lte: periodo.fechaFin } }
        : { createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin } };

    const snapshots: SaldoSnapshot[] = [];

    for (const cuenta of cuentas) {
      const saldo = await this._calcularSaldoCuenta(
        cuenta.cuentaId,
        periodo.tenantId,
        dateFilter,
        field,
      );

      const snapshot = await prisma.saldoSnapshot.create({
        data: {
          periodoId,
          cuentaBancariaId: cuenta.cuentaId,
          saldo,
          moneda: cuenta.moneda,
          metadata: {
            tipo,
            fechaInicio: periodo.fechaInicio.toISOString(),
            fechaFin: periodo.fechaFin.toISOString(),
            generadoPor: actor,
          },
        },
      });

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  /**
   * Verifica que un snapshot existe y no fue modificado.
   *
   * Compara el saldo almacenado en el snapshot con el cálculo actual
   * de las reconciliaciones en el mismo rango. Si coinciden, el snapshot
   * es íntegro.
   *
   * @param {string} snapshotId - ID del snapshot a verificar.
   * @returns {Promise<boolean>} True si el snapshot es íntegro.
   */
  async verificarIntegridad(snapshotId: string): Promise<boolean> {
    const snapshot = await prisma.saldoSnapshot.findUnique({
      where: { snapshotId },
      include: {
        periodo: true,
      },
    });

    if (!snapshot) {
      return false;
    }

    const metadata = (snapshot.metadata as Record<string, unknown>) ?? {};
    const tipo = (metadata.tipo as 'caja' | 'devengo') ?? 'caja';

    const dateFilter =
      tipo === 'caja'
        ? { fechaReconciliacion: { gte: snapshot.periodo.fechaInicio, lte: snapshot.periodo.fechaFin } }
        : { createdAt: { gte: snapshot.periodo.fechaInicio, lte: snapshot.periodo.fechaFin } };

    const field = tipo === 'caja' ? 'fechaReconciliacion' : 'createdAt';

    const saldoActual = await this._calcularSaldoCuenta(
      snapshot.cuentaBancariaId,
      snapshot.periodo.tenantId,
      dateFilter,
      field,
    );

    // Comparar con tolerancia de punto flotante
    return Math.abs(saldoActual - snapshot.saldo) < 0.01;
  }

  /**
   * Obtiene el último snapshot de un período para un tipo dado.
   *
   * @param {string} periodoId - ID del período.
   * @param {'caja' | 'devengo'} tipo - Tipo de snapshot.
   * @returns {Promise<SaldoSnapshot | null>} Último snapshot o null.
   */
  async obtenerUltimoSnapshot(
    periodoId: string,
    tipo: 'caja' | 'devengo',
  ): Promise<SaldoSnapshot | null> {
    // Buscamos snapshots del período cuyo metadata.tipo coincida
    const snapshots = await prisma.saldoSnapshot.findMany({
      where: { periodoId },
      orderBy: { createdAt: 'desc' },
    });

    // Filtrar por tipo en metadata (no hay columna tipo en SaldoSnapshot)
    for (const s of snapshots) {
      const metadata = (s.metadata as Record<string, unknown>) ?? {};
      if (metadata.tipo === tipo) {
        return s;
      }
    }

    return null;
  }

  // ── Helpers internos ────────────────────────────────────────────────────

  /**
   * Calcula el saldo histórico de una cuenta bancaria a una fecha dada.
   *
   * Usa la fórmula: saldo al día X = saldo actual − transacciones ocurridas DESPUÉS de X.
   *
   * Esto evita depender de un "saldo inicial" y funciona aunque la cuenta
   * se haya creado con un saldo que no corresponda a una transacción real.
   *
   * @param {string} cuentaId - ID de la cuenta bancaria
   * @param {string} tenantId - ID del tenant
   * @param {Date} fecha - Fecha objetivo (inclusive, fin del día)
   * @returns {Promise<number>} Saldo calculado a la fecha
   */
  async calcularSaldoHistorico(
    cuentaId: string,
    tenantId: string,
    fecha: Date,
  ): Promise<number> {
    const finDelDia = new Date(fecha);
    finDelDia.setHours(23, 59, 59, 999);

    // 1. Obtener saldo actual
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId },
      select: { saldo: true },
    });

    if (!cuenta) {
      throw new Error(`Cuenta bancaria no encontrada: ${cuentaId}`);
    }

    // 2. Calcular transacciones ocurridas DESPUÉS de la fecha objetivo
    const transaccionesDespues = await this._calcularTransaccionesNetas(
      cuentaId,
      tenantId,
      { gte: new Date(finDelDia.getTime() + 1) }, // desde el día siguiente
    );

    // 3. Saldo histórico = saldo actual - transacciones después de la fecha
    return Number(cuenta.saldo) - transaccionesDespues;
  }

  /**
   * Calcula el saldo histórico usando un snapshot como punto de partida.
   *
   * Más preciso que {@link calcularSaldoHistorico} porque arranca de un
   * saldo congelado en el tiempo y solo suma transacciones posteriores.
   *
   * @param {string} snapshotId - ID del snapshot base
   * @param {Date} fecha - Fecha objetivo (debe ser posterior al snapshot)
   * @returns {Promise<{saldo: number, snapshotBase: string, transaccionesNetas: number}>}
   */
  async calcularSaldoDesdeSnapshot(
    snapshotId: string,
    fecha: Date,
  ): Promise<{ saldo: number; snapshotBase: string; transaccionesNetas: number }> {
    const snapshot = await prisma.saldoSnapshot.findUnique({
      where: { snapshotId },
      include: {
        periodo: { select: { tenantId: true } },
      },
    });

    if (!snapshot) {
      throw new Error(`Snapshot no encontrado: ${snapshotId}`);
    }

    const finDelDia = new Date(fecha);
    finDelDia.setHours(23, 59, 59, 999);

    // Calcular transacciones entre el fin del período del snapshot y la fecha objetivo
    const transaccionesNetas = await this._calcularTransaccionesNetas(
      snapshot.cuentaBancariaId,
      snapshot.periodo.tenantId,
      {
        gte: snapshot.periodo.fechaFin,
        lte: finDelDia,
      },
    );

    return {
      saldo: Number(snapshot.saldo) + transaccionesNetas,
      snapshotBase: snapshotId,
      transaccionesNetas,
    };
  }

  // ── Helpers internos ────────────────────────────────────────────────────

  /**
   * Calcula el neto de transacciones de una cuenta en un rango de fechas.
   *
   * Fórmula: ingresos (ventas + servicios) - egresos (gastos) + ajustes - transferencias salientes + transferencias entrantes
   *
   * @private
   */
  private async _calcularTransaccionesNetas(
    cuentaId: string,
    tenantId: string,
    dateRange: { gte?: Date; lte?: Date },
  ): Promise<number> {
    const ventas = await prisma.reconciliacionVenta.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, cuentaId, fechaReconciliacion: dateRange },
    });

    const servicios = await prisma.reconciliacionServicio.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, cuentaId, fechaReconciliacion: dateRange },
    });

    const gastos = await prisma.reconciliacionGasto.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, cuentaId, fechaReconciliacion: dateRange },
    });

    const ajustes = await prisma.ajusteBancario.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, cuentaId, createdAt: dateRange },
    });

    const transSalientes = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoOrigen: true },
      where: { tenantId, cuentaOrigenId: cuentaId, fechaTransferencia: dateRange },
    });

    const transEntrantes = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoDestino: true },
      where: { tenantId, cuentaDestinoId: cuentaId, fechaTransferencia: dateRange },
    });

    return (
      Number(ventas._sum.montoConvertido ?? 0) +
      Number(servicios._sum.montoConvertido ?? 0) -
      Number(gastos._sum.montoConvertido ?? 0) +
      Number(ajustes._sum.montoConvertido ?? 0) -
      Number(transSalientes._sum.montoOrigen ?? 0) +
      Number(transEntrantes._sum.montoDestino ?? 0)
    );
  }

  /**
   * Calcula el saldo neto de una cuenta bancaria en un rango de fechas.
   *
   * Saldo = ingresos (ventas + servicios) - egresos (gastos) + ajustes + transferencias netas
   *
   * Usa el registro canónico {@link fecha-operacion-registry} para determinar
   * el campo de fecha correcto para cada tipo de entidad.
   */
  private async _calcularSaldoCuenta(
    cuentaId: string,
    tenantId: string,
    _dateFilter: Record<string, unknown>,
    field: string,
  ): Promise<number> {
    const usarCaja = field === 'fechaReconciliacion';

    // Extraer rango de fechas del dateFilter (viene armado desde generarSnapshot)
    const rangoFechas = (
      _dateFilter.fechaReconciliacion ??
      _dateFilter.createdAt ??
      {}
    ) as { gte?: Date; lte?: Date };

    // En modo caja las reconciliaciones filtran por fechaReconciliacion;
    // en modo devengo filtran por createdAt (fecha de registro).
    const filtroReconciliacion = usarCaja
      ? { fechaReconciliacion: rangoFechas }
      : { createdAt: rangoFechas };

    // Ajustes siempre usan createdAt (no tienen fechaOperacion aún)
    // Transferencias siempre usan fechaTransferencia

    // 1. Ingresos por reconciliaciones de venta
    const ventasResult = await prisma.reconciliacionVenta.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...filtroReconciliacion,
      },
    });

    // 2. Ingresos por reconciliaciones de servicio
    const serviciosResult = await prisma.reconciliacionServicio.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...filtroReconciliacion,
      },
    });

    // 3. Egresos por reconciliaciones de gasto
    const gastosResult = await prisma.reconciliacionGasto.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...filtroReconciliacion,
      },
    });

    // 4. Ajustes bancarios — usan createdAt
    const ajustesResult = await prisma.ajusteBancario.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        createdAt: rangoFechas,
      },
    });

    // 5. Transferencias — filtran por fechaTransferencia
    const transferenciasOrigen = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoOrigen: true },
      where: {
        tenantId,
        cuentaOrigenId: cuentaId,
        fechaTransferencia: rangoFechas,
      },
    });

    const transferenciasDestino = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoDestino: true },
      where: {
        tenantId,
        cuentaDestinoId: cuentaId,
        fechaTransferencia: rangoFechas,
      },
    });

    const ingresos =
      (ventasResult._sum.montoConvertido ? Number(ventasResult._sum.montoConvertido) : 0) +
      (serviciosResult._sum.montoConvertido ? Number(serviciosResult._sum.montoConvertido) : 0);

    const egresos = gastosResult._sum.montoConvertido
      ? Number(gastosResult._sum.montoConvertido)
      : 0;

    const ajustes = ajustesResult._sum.montoConvertido
      ? Number(ajustesResult._sum.montoConvertido)
      : 0;

    const transSalientes = transferenciasOrigen._sum.montoOrigen
      ? Number(transferenciasOrigen._sum.montoOrigen)
      : 0;

    const transEntrantes = transferenciasDestino._sum.montoDestino
      ? Number(transferenciasDestino._sum.montoDestino)
      : 0;

    return ingresos - egresos + ajustes - transSalientes + transEntrantes;
  }

  /**
   * @description Genera el resumen agregado de saldos y el hash de integridad para un período.
   *
   * Calcula totales por moneda de cada categoría de cuenta, el total de ingresos
   * y egresos del período, y genera un hash SHA256 sobre el resumen serializado
   * para verificar integridad futura.
   *
   * @param {string} tenantId - ID del tenant.
   * @param {Date} fechaInicio - Inicio del período.
   * @param {Date} fechaFin - Fin del período.
   * @returns {Promise<{ resumenJson: Record<string, unknown>; hashIntegridad: string }>}
   */
  async generarResumenSnapshot(
    tenantId: string,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<{ resumenJson: Record<string, unknown>; hashIntegridad: string }> {
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { tenantId, isActive: true },
    });

    const rango = { gte: fechaInicio, lte: fechaFin };
    const saldosPorMoneda: Record<string, number> = {};
    const cuentasDetalle: Array<{
      cuentaId: string;
      nombre: string;
      moneda: string;
      saldo: number;
    }> = [];

    for (const cuenta of cuentas) {
      const saldo = await this._calcularSaldoCuenta(
        cuenta.cuentaId,
        tenantId,
        { fechaReconciliacion: rango },
        'fechaReconciliacion',
      );

      saldosPorMoneda[cuenta.moneda] = (saldosPorMoneda[cuenta.moneda] ?? 0) + saldo;

      cuentasDetalle.push({
        cuentaId: cuenta.cuentaId,
        nombre: cuenta.nombre ?? 'Sin nombre',
        moneda: cuenta.moneda,
        saldo,
      });
    }

    // Total de ingresos en el período
    const ingresos = await prisma.reconciliacionVenta.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, fechaReconciliacion: rango },
    });

    const ingresosServicios = await prisma.reconciliacionServicio.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, fechaReconciliacion: rango },
    });

    const totalIngresos =
      Number(ingresos._sum.montoConvertido ?? 0) +
      Number(ingresosServicios._sum.montoConvertido ?? 0);

    // Total de egresos en el período
    const egresos = await prisma.reconciliacionGasto.aggregate({
      _sum: { montoConvertido: true },
      where: { tenantId, fechaReconciliacion: rango },
    });

    const totalEgresos = Number(egresos._sum.montoConvertido ?? 0);

    const resumen = {
      version: 1,
      generadoEn: new Date().toISOString(),
      totalCuentas: cuentas.length,
      saldosPorMoneda,
      totales: {
        ingresos: totalIngresos,
        egresos: totalEgresos,
        neto: totalIngresos - totalEgresos,
      },
      cuentas: cuentasDetalle,
    };

    // Generar hash SHA256 para verificación de integridad
    const serializado = JSON.stringify(resumen);
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(serializado),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return { resumenJson: resumen as unknown as Record<string, unknown>, hashIntegridad: hashHex };
  }

  /**
   * @description Crea una versión historificada de SnapshotPeriodo.
   *
   * Determina la próxima versión disponible y persiste los datos de snapshot
   * en un registro versionado. Cada cierre o re-cierre incrementa la versión.
   *
   * @param {string} periodoId - ID del período.
   * @param {Object} params - Datos del snapshot versionado.
   * @param {Record<string, unknown>} [params.resumenJson] - Resumen agregado.
   * @param {string} [params.hashIntegridad] - Hash de integridad.
   * @returns {Promise<SnapshotPeriodo>} SnapshotPeriodo creado.
   */
  async crearVersionSnapshot(
    periodoId: string,
    params: {
      resumenJson?: Record<string, unknown>;
      hashIntegridad?: string;
    },
  ): Promise<SnapshotPeriodo> {
    // Determinar próxima versión
    const ultimaVersion = await prisma.snapshotPeriodo.findFirst({
      where: { periodoId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const proximaVersion = (ultimaVersion?.version ?? 0) + 1;

    // Obtener snapshots actuales de SaldoSnapshot para serializar
    const snapshotsActuales = await prisma.saldoSnapshot.findMany({
      where: { periodoId },
      orderBy: { createdAt: 'desc' },
    });

    const baseCaja = snapshotsActuales.length > 0
      ? snapshotsActuales.map((s) => ({
          cuentaBancariaId: s.cuentaBancariaId,
          saldo: s.saldo,
          moneda: s.moneda,
          createdAt: s.createdAt.toISOString(),
        }))
      : null;

    // Crear SnapshotPeriodo versionado
    const snapshotPeriodo = await prisma.snapshotPeriodo.create({
      data: {
        periodoId,
        version: proximaVersion,
        baseCajaJson: baseCaja as Record<string, unknown>[] | null,
        resumenJson: params.resumenJson,
        hashIntegridad: params.hashIntegridad,
      },
    });

    return snapshotPeriodo;
  }
}

