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
import type { SaldoSnapshot } from '@/generated/prisma';
import { SnapshotTotales } from './periodo-contable-types';

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
   * Calcula el saldo neto de una cuenta bancaria en un rango de fechas.
   *
   * Saldo = ingresos (ventas + servicios) - egresos (gastos) + ajustes + transferencias netas
   */
  private async _calcularSaldoCuenta(
    cuentaId: string,
    tenantId: string,
    dateFilter: Record<string, unknown>,
    field: string,
  ): Promise<number> {
    // 1. Ingresos por reconciliaciones de venta
    const ventasResult = await prisma.reconciliacionVenta.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...dateFilter,
      },
    });

    // 2. Ingresos por reconciliaciones de servicio
    const serviciosResult = await prisma.reconciliacionServicio.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...dateFilter,
      },
    });

    // 3. Egresos por reconciliaciones de gasto
    const gastosResult = await prisma.reconciliacionGasto.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        ...dateFilter,
      },
    });

    // 4. Ajustes bancarios
    const ajustesResult = await prisma.ajusteBancario.aggregate({
      _sum: { montoConvertido: true },
      where: {
        tenantId,
        cuentaId,
        createdAt: dateFilter.createdAt as Record<string, unknown> | undefined,
      },
    });

    // 5. Transferencias: salientes (origen) y entrantes (destino)
    const transferenciasOrigen = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoOrigen: true },
      where: {
        tenantId,
        cuentaOrigenId: cuentaId,
        fechaTransferencia: { gte: (dateFilter.createdAt as Record<string, unknown> | undefined)?.gte, lte: (dateFilter.createdAt as Record<string, unknown> | undefined)?.lte } as Record<string, unknown> | undefined,
      },
    });

    const transferenciasDestino = await prisma.transferenciaBancaria.aggregate({
      _sum: { montoDestino: true },
      where: {
        tenantId,
        cuentaDestinoId: cuentaId,
        fechaTransferencia: { gte: (dateFilter.createdAt as Record<string, unknown> | undefined)?.gte, lte: (dateFilter.createdAt as Record<string, unknown> | undefined)?.lte } as Record<string, unknown> | undefined,
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
}
