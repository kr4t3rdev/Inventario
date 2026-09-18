/**
 * @description Guardias del reporte financiero tras la corrección multimonreda.
 * Verifica que los lectores de reconciliaciones nunca suman importes
 * de monedas distintas en un solo total (fase MM-4.4).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  cuentaBancaria: { findMany: vi.fn() },
  reconciliacionVenta: { findMany: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn() },
  reconciliacionServicio: { findMany: vi.fn() },
  transferenciaBancaria: { findMany: vi.fn() },
  ajusteBancario: { findMany: vi.fn() },
  inyeccionCapital: { findMany: vi.fn() },
  pagoDeuda: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true,
    },
  })),
}));

// Los servicios de política/reporte se mockean para acotar a los lectores planos.
vi.mock('@/features/contabilidad/services/historical-financial-report-service', () => ({
  listAvailableFinancialPeriods: vi.fn(),
  resolveFinancialReport: vi.fn(),
}));

import { getResumenFinanciero, getMovimientosReport } from '@/features/contabilidad/api/handlers';

const TENANT_URL = 'http://localhost:3000/api/contabilidad/resumen-financiero';

describe('lectores contables multimonreda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getResumenFinanciero no mezcla totales de monedas distintas', async () => {
    prismaMock.cuentaBancaria.findMany.mockResolvedValue([
      { nombreBanco: 'Banco', numeroCuenta: '1', saldo: 1000, moneda: 'CUP' },
      { nombreBanco: 'Banco', numeroCuenta: '2', saldo: 50, moneda: 'USD' },
    ]);
    prismaMock.reconciliacionVenta.findMany.mockResolvedValue([
      { monto: 500, moneda: 'CUP', tipoReconciliacion: null },
      { monto: 10, moneda: 'USD', tipoReconciliacion: null },
    ]);
    prismaMock.reconciliacionGasto.findMany.mockResolvedValue([
      { monto: 200, moneda: 'CUP' },
    ]);

    const response = await getResumenFinanciero(new NextRequest(TENANT_URL));
    const body = await response.json();

    const porMoneda = Object.fromEntries(
      body.resumenPorMoneda.map((r: any) => [
        r.moneda,
        { ingresos: r.totalIngresos, saldo: r.saldoActual, egresos: r.totalEgresos },
      ]),
    );

    expect(porMoneda.CUP).toEqual({ ingresos: 500, saldo: 1000, egresos: 200 });
    expect(porMoneda.USD).toEqual({ ingresos: 10, saldo: 50, egresos: 0 });
    // La clave del fix: USD no aparece dentro de los CUP
    expect(porMoneda.CUP.ingresos).not.toContain(10);
  });

  it('getMovimientosReport etiqueta cada fila con su propia moneda', async () => {
    prismaMock.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'r1', monto: 100, moneda: 'USD', tasaCambio: null,
        fechaReconciliacion: new Date(), observaciones: null, reconciliadoPor: 'u1',
        tipoReconciliacion: 'NORMAL',
        venta: { ventaId: 'v1', total: 100, createdAt: new Date() },
        prestamoCash: null, deudaCash: null,
        cuentaBancaria: { nombreBanco: 'B', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' },
      },
      {
        reconciliacionId: 'r2', monto: 200, moneda: 'CUP', tasaCambio: null,
        fechaReconciliacion: new Date(), observaciones: null, reconciliadoPor: 'u1',
        tipoReconciliacion: 'NORMAL',
        venta: { ventaId: 'v2', total: 200, createdAt: new Date() },
        prestamoCash: null, deudaCash: null,
        cuentaBancaria: { nombreBanco: 'B', numeroCuenta: '1' },
        tipoPago: { nombre: 'Efectivo' },
      },
    ]);
    prismaMock.reconciliacionServicio.findMany.mockResolvedValue([]);
    prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);
    prismaMock.transferenciaBancaria.findMany.mockResolvedValue([]);
    prismaMock.ajusteBancario.findMany.mockResolvedValue([]);
    prismaMock.inyeccionCapital.findMany.mockResolvedValue([]);
    prismaMock.pagoDeuda.findMany.mockResolvedValue([]);

    const response = await getMovimientosReport(
      new NextRequest('http://localhost:3000/api/contabilidad/movimientos'),
    );
    const body = await response.json();

    const usd = body.data.find((m: any) => m.id === 'r1');
    const cup = body.data.find((m: any) => m.id === 'r2');
    expect(usd.moneda).toBe('USD');
    expect(cup.moneda).toBe('CUP');
  });
});
