import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock, setFeature } = vi.hoisted(() => {
  const prismaMock = {
    puntoDeVenta: { findMany: vi.fn(), findFirst: vi.fn() },
    turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    devolucionVenta: { aggregate: vi.fn().mockResolvedValue({ _sum: { montoReembolsado: 0 } }) },
    arqueoCaja: { create: vi.fn() },
    venta: { aggregate: vi.fn() },
    ventaItem: { findMany: vi.fn() },
    stockUbicacion: { findMany: vi.fn() },
  };
  const setFeature = vi.fn();
  return { prismaMock, setFeature };
});

let currentTenantId: string | null = 'tenant-1';

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: { userId: 'user-1', tenantId: currentTenantId, role: 'admin' },
  })),
}));

vi.mock('@/lib/services/tenant-scope', async () => {
  const actual = await vi.importActual('@/lib/services/tenant-scope');
  return {
    ...actual,
    requireFeature: vi.fn(),
    requireTenant: vi.fn(() => currentTenantId),
  };
});

vi.mock('@/lib/services/stock-ubicacion-queries', () => ({
  getStockPorUbicacionBatch: vi.fn(async () => new Map()),
}));

import { GET as getPuntosVenta } from '../pos/puntos-venta/route';
import { POST as abrirTurno } from '../pos/turnos/route';
import { GET as getTurnoActivo } from '../pos/turnos/activo/route';
import { GET as getEsperados } from '../pos/turnos/esperados/route';
import { POST as registrarArqueo } from '../pos/turnos/arqueo/route';
import { GET as getCuadre } from '../pos/turnos/cuadre/route';
import { POST as cerrarTurno } from '../pos/turnos/cerrar/route';

const pvRow = { pvId: 'pv-1', nombre: 'Mostrador 1', ubicacion: null, tipoCaja: 'PRINCIPAL', listaPrecio: null };

const turnoAbierto = {
  id: 'turno-1',
  puntoDeVentaId: 'pv-1',
  puntoDeVenta: { pvId: 'pv-1', nombre: 'Mostrador 1' },
  empleadoId: null,
  empleado: null,
  tipo: 'NORMAL',
  estado: 'ABIERTO',
  fechaApertura: new Date('2026-05-01T09:00:00Z'),
  fechaCierre: null,
  fondoInicialCup: 1000,
  fondoInicialUsd: 0,
  observaciones: null,
  ventas: [{ total: 500 }],
  _count: { ventas: 1 },
};

describe('Mobile POS: puntos-venta & turnos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenantId = 'tenant-1';
  });

  it('GET /pos/puntos-venta lists tenant points of sale', async () => {
    (prismaMock.puntoDeVenta.findMany as Mock).mockResolvedValue([pvRow]);
    const res = await getPuntosVenta(new NextRequest('http://localhost/api/mobile/pos/puntos-venta'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.items[0]).toMatchObject({ pvId: 'pv-1', nombre: 'Mostrador 1', tipoCaja: 'PRINCIPAL' });
  });

  it('POST /pos/turnos opens a shift (201)', async () => {
    (prismaMock.puntoDeVenta.findFirst as Mock).mockResolvedValue(pvRow);
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue(null); // no active
    (prismaMock.turnoPuntoVenta.create as Mock).mockResolvedValue(turnoAbierto);

    const res = await abrirTurno(new NextRequest('http://localhost/api/mobile/pos/turnos', {
      method: 'POST',
      body: JSON.stringify({ puntoDeVentaId: 'pv-1', fondoInicialCup: 1000 }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.turno.estado).toBe('ABIERTO');
  });

  it('POST /pos/turnos returns 409 when a shift is already open', async () => {
    (prismaMock.puntoDeVenta.findFirst as Mock).mockResolvedValue(pvRow);
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({ id: 'turno-1' });

    const res = await abrirTurno(new NextRequest('http://localhost/api/mobile/pos/turnos', {
      method: 'POST',
      body: JSON.stringify({ puntoDeVentaId: 'pv-1' }),
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('CONFLICT');
  });

  it('GET /pos/turnos/activo returns null when no shift is open', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue(null);
    const res = await getTurnoActivo(new NextRequest('http://localhost/api/mobile/pos/turnos/activo?puntoDeVentaId=pv-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.turno).toBeNull();
  });

  it('GET /pos/turnos/esperados computes expected amounts from sales', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({
      ...turnoAbierto,
      ventas: [
        { metodoPago: 'EFECTIVO', montoEfectivo: 500, montoTarjeta: 0, montoTransferencia: 0, montoCredito: 0 },
      ],
    });
    const res = await getEsperados(new NextRequest('http://localhost/api/mobile/pos/turnos/esperados?turnoId=turno-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.esperadoEfectivoCup).toBe(500);
  });

  it('POST /pos/turnos/arqueo creates an arqueo with computed differences', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({
      ...turnoAbierto,
      ventas: [],
    });
    (prismaMock.arqueoCaja.create as Mock).mockResolvedValue({
      id: 'arq-1',
      turnoId: 'turno-1',
      totalEfectivoCup: 1000,
      totalEfectivoUsd: 0,
      totalTarjeta: 0,
      totalTransferencia: 0,
      totalCredito: 0,
      esperadoEfectivoCup: 0,
      esperadoTarjeta: 0,
      esperadoTransferencia: 0,
      esperadoCredito: 0,
      diferenciaCup: 0,
      diferenciaUsd: 0,
      createdAt: new Date('2026-05-01T18:00:00Z'),
    });

    const res = await registrarArqueo(new NextRequest('http://localhost/api/mobile/pos/turnos/arqueo', {
      method: 'POST',
      body: JSON.stringify({ turnoId: 'turno-1', totalTarjeta: 0, totalTransferencia: 0, totalCredito: 0 }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.diferencias).toBeDefined();
  });

  it('GET /pos/turnos/cuadre returns closure report', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({
      ...turnoAbierto,
      arqueos: [{ id: 'arq-1', diferenciaCup: 0, diferenciaUsd: 0, createdAt: new Date() }],
      puntoDeVenta: { pvId: 'pv-1', nombre: 'Mostrador 1', almacenId: 'alm-1' },
    });
    (prismaMock.ventaItem.findMany as Mock).mockResolvedValue([]);
    (prismaMock.venta.aggregate as Mock).mockResolvedValue({ _sum: { total: 500 } });

    const res = await getCuadre(new NextRequest('http://localhost/api/mobile/pos/turnos/cuadre?turnoId=turno-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.turno.id).toBe('turno-1');
    expect(data.resumen).toBeDefined();
  });

  it('GET /pos/turnos/cuadre returns 409 without an arqueo', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({ ...turnoAbierto, arqueos: [] });
    const res = await getCuadre(new NextRequest('http://localhost/api/mobile/pos/turnos/cuadre?turnoId=turno-1'));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('NO_ARQUEO');
  });

  it('POST /pos/turnos/cerrar closes the shift when arqueo matches', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({
      ...turnoAbierto,
      fondoInicialCup: 0,
      arqueos: [{
        id: 'arq-1',
        totalEfectivoCup: 50000,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalCredito: 0,
      }],
    });
    (prismaMock.venta.aggregate as Mock).mockResolvedValue({ _sum: { total: 500 } });
    (prismaMock.turnoPuntoVenta.update as Mock).mockResolvedValue({
      ...turnoAbierto,
      estado: 'CERRADO',
      fechaCierre: new Date('2026-05-01T20:00:00Z'),
    });

    const res = await cerrarTurno(new NextRequest('http://localhost/api/mobile/pos/turnos/cerrar', {
      method: 'POST',
      body: JSON.stringify({ turnoId: 'turno-1' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.turno.estado).toBe('CERRADO');
  });

  it('POST /pos/turnos/cerrar rejects when arqueo mismatches', async () => {
    (prismaMock.turnoPuntoVenta.findFirst as Mock).mockResolvedValue({
      ...turnoAbierto,
      fondoInicialCup: 0,
      arqueos: [{
        id: 'arq-1',
        totalEfectivoCup: 10000,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalCredito: 0,
      }],
    });
    (prismaMock.venta.aggregate as Mock).mockResolvedValue({ _sum: { total: 500 } });

    const res = await cerrarTurno(new NextRequest('http://localhost/api/mobile/pos/turnos/cerrar', {
      method: 'POST',
      body: JSON.stringify({ turnoId: 'turno-1' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('ARQUEO_MISMATCH');
  });
});