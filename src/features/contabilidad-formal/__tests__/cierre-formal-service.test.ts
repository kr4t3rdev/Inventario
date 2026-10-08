import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { generarAsientoApertura, generarAsientoCierre } from '@/features/contabilidad-formal/services/cierre-formal-service';

const db = vi.hoisted(() => ({
  asiento: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  asientoLinea: { groupBy: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  aperturaPeriodo: { findUnique: vi.fn(), findFirst: vi.fn() },
  periodoContable: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  cuentaRolTenant: { findMany: vi.fn() },
  cuentaContable: { findMany: vi.fn() },
  diario: { findFirst: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  withAccountingTenantLock: vi.fn(async (_tx, _tenant, op) => op()),
}));

function prepararAperturaValidacion(
  aperturaOrigen: string | null,
  ingreso: string,
  gasto: string,
  debeResultado: string,
  haberResultado: string,
): void {
  db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
    origenPeriodoId: aperturaOrigen, saldoCajaInicial: new Prisma.Decimal(100), saldoBancoInicial: new Prisma.Decimal(0),
    saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
    saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(100),
    saldoResultadoAcumInicial: new Prisma.Decimal(0) });
  db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
    fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
  db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
    fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
  db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ asientoId: 'close-p1' });
  db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
    'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
    rol, cuenta: { cuentaContableId: `${rol}-id` },
  })));
  db.asientoLinea.findFirst.mockResolvedValue({ debe: new Prisma.Decimal(debeResultado),
    haber: new Prisma.Decimal(haberResultado) });
  db.asientoLinea.findMany.mockResolvedValue([
    { cuentaId: 'ingreso', debe: new Prisma.Decimal(ingreso), haber: new Prisma.Decimal(0) },
    { cuentaId: 'gasto', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(gasto) },
    { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(debeResultado),
      haber: new Prisma.Decimal(haberResultado) },
  ]);
  db.asientoLinea.groupBy.mockResolvedValue([
    { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(ingreso) } },
    { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal(gasto), haber: new Prisma.Decimal(0) } },
  ]);
}

describe('cierre formal: saldos firmados exactos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    db.asiento.findFirst.mockResolvedValue(null);
    db.asiento.findUnique.mockResolvedValue(null);
    db.asiento.findMany.mockResolvedValue([]);
    db.asiento.aggregate.mockResolvedValue({ _max: { numero: null } });
    db.asiento.create.mockResolvedValue({ asientoId: 'cierre-1' });
    db.asientoLinea.groupBy.mockResolvedValue([]);
    db.asientoLinea.findMany.mockResolvedValue([]);
    db.diario.findFirst.mockResolvedValue({ diarioId: 'diario-1' });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-01-31'), tipo: 'MENSUAL' });
    db.periodoContable.findMany.mockResolvedValue([]);
    db.cuentaRolTenant.findMany.mockResolvedValue([{ rol: 'RESULTADO_PERIODO',
      cuenta: { cuentaContableId: 'resultado' } }]);
    db.cuentaContable.findMany.mockResolvedValue([
      { cuentaContableId: 'ingreso', tipo: 'INGRESO' },
      { cuentaContableId: 'gasto', tipo: 'GASTO' },
    ]);
  });

  it('saldos inversos y pérdida subcentésima producen líneas positivas y cuadradas', async () => {
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal('0.0002'),
        haber: new Prisma.Decimal('0.0001') } },
      { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal('0.0004'),
        haber: new Prisma.Decimal('0.0001') } },
    ]);
    const resultado = await generarAsientoCierre(db as never, {
      periodoId: 'p1', tenantId: 't1', actorId: 'u1', fecha: new Date('2026-09-30'),
    });
    expect(resultado.estado).toBe('CONTABILIZADO');
    const lineas = db.asiento.create.mock.calls[0][0].data.lineas.create;
    expect(lineas.map((l: { debe: Prisma.Decimal; haber: Prisma.Decimal }) =>
      [l.debe.toString(), l.haber.toString()])).toEqual([
      ['0', '0.0001'], ['0', '0.0003'], ['0.0004', '0'],
    ]);
  });

  it('normaliza fecha de cierre fuera del período al último día contable válido', async () => {
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-01-31') });
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(10) } },
    ]);
    await generarAsientoCierre(db as never, { periodoId: 'p1', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    expect(db.asiento.create.mock.calls[0][0].data.fecha).toEqual(new Date('2026-01-31'));
  });

  it('registra utilidad en haber de resultado, con magnitud positiva', async () => {
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(10) } },
      { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal(3), haber: new Prisma.Decimal(0) } },
    ]);
    await generarAsientoCierre(db as never, { periodoId: 'p1', tenantId: 't1', actorId: 'u1' });
    const lines = db.asiento.create.mock.calls[0][0].data.lineas.create;
    expect(lines.at(-1).haber.toString()).toBe('7');
    expect(lines.at(-1).debe.toString()).toBe('0');
  });

  it('falla cerrado cuando falta el rol de resultados del período', async () => {
    db.cuentaRolTenant.findMany.mockResolvedValue([]);
    await expect(generarAsientoCierre(db as never, { periodoId: 'p1', tenantId: 't1', actorId: 'u1' }))
      .rejects.toThrow('Faltan roles contables');
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('no duplica el traspaso cuando la apertura ya existe', async () => {
    db.asiento.findFirst.mockResolvedValue({ asientoId: 'open-p2' });
    const result = await generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    expect(result).toEqual({ estado: 'YA_EXISTENTE', asientoId: 'open-p2' });
    expect(db.asientoLinea.findFirst).not.toHaveBeenCalled();
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('no crea contrapartida de resultado cuando el neto es cero', async () => {
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(5) } },
      { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal(5), haber: new Prisma.Decimal(0) } },
    ]);
    await generarAsientoCierre(db as never, { periodoId: 'p1', tenantId: 't1', actorId: 'u1' });
    const lines = db.asiento.create.mock.calls[0][0].data.lineas.create;
    expect(lines).toHaveLength(2);
    const debitTotal = lines.reduce((sum: Prisma.Decimal, line: { debe: Prisma.Decimal }) => sum.plus(line.debe), new Prisma.Decimal(0));
    const creditTotal = lines.reduce((sum: Prisma.Decimal, line: { haber: Prisma.Decimal }) => sum.plus(line.haber), new Prisma.Decimal(0));
    expect(debitTotal.eq(creditTotal)).toBe(true);
  });

  it('marca un período sin movimiento de resultado como cierre omitido con resultado cero explícito', async () => {
    const result = await generarAsientoCierre(db as never, { periodoId: 'p1', tenantId: 't1', actorId: 'u1' });
    expect(result).toEqual({ estado: 'OMITIDO', motivo: 'RESULTADO_CERO_SIN_MOVIMIENTOS' });
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('rechaza apertura con saldos descuadrados antes de insertar', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(9), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(0),
      saldoResultadoAcumInicial: new Prisma.Decimal(0) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ asientoId: 'close-p1' });
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'ingreso', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(1) },
      { cuentaId: 'gasto', debe: new Prisma.Decimal(1), haber: new Prisma.Decimal(0) },
    ]);
    db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
      'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
      rol, cuenta: { cuentaContableId: `${rol}-id` },
    })));
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow('no cuadra');
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('invierte los lados al traspasar una pérdida a resultados acumulados', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(0), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(0),
      saldoResultadoAcumInicial: new Prisma.Decimal(0) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ asientoId: 'close-p1' });
    db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
      'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
      rol, cuenta: { cuentaContableId: `${rol}-id` },
    })));
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'gasto', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(8) },
      { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(8), haber: new Prisma.Decimal(0) },
    ]);
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(0) } },
      { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal(8), haber: new Prisma.Decimal(0) } },
    ]);
    await generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    const lines = db.asiento.create.mock.calls[0][0].data.lineas.create;
    expect(lines.map((line: { cuentaId: string; debe: Prisma.Decimal; haber: Prisma.Decimal }) =>
      [line.cuentaId, line.debe.toString(), line.haber.toString()])).toEqual([
      ['RESULTADO_PERIODO-id', '0', '8'], ['RESULTADOS_ACUMULADOS-id', '8', '0'],
    ]);
  });

  it('rechaza apertura si no existe cierre aprobado del período inmediatamente anterior', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(100), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(0),
      saldoResultadoAcumInicial: new Prisma.Decimal(100) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValue(null);
    db.asientoLinea.groupBy.mockResolvedValue([{ cuentaId: 'ingreso', _sum: {
      debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(100),
    } }]);
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('carga apertura por tenant y rechaza un registro con tenant distinto', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't2' });
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
    expect(db.aperturaPeriodo.findFirst).toHaveBeenCalledWith({ where: { periodoId: 'p2', tenantId: 't1' } });
  });

  it('crea apertura balanceada y traslada una utilidad verificada del período anterior', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(100), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(100),
      saldoResultadoAcumInicial: new Prisma.Decimal(0) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ asientoId: 'close-p1' });
    db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
      'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
      rol, cuenta: { cuentaContableId: `${rol}-id` },
    })));
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'ingreso', debe: new Prisma.Decimal(10), haber: new Prisma.Decimal(0) },
      { cuentaId: 'gasto', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(3) },
      { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(7) },
    ]);
    db.asientoLinea.groupBy.mockResolvedValue([
      { cuentaId: 'ingreso', _sum: { debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(10) } },
      { cuentaId: 'gasto', _sum: { debe: new Prisma.Decimal(3), haber: new Prisma.Decimal(0) } },
    ]);
    const result = await generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    expect(result.estado).toBe('CONTABILIZADO');
    const lines = db.asiento.create.mock.calls[0][0].data.lineas.create;
    expect(lines.find((line: { cuentaId: string }) => line.cuentaId === 'RESULTADOS_ACUMULADOS-id').haber.toString())
      .toBe('7');
    expect(lines.reduce((sum: Prisma.Decimal, line: { debe: Prisma.Decimal }) => sum.plus(line.debe), new Prisma.Decimal(0))
      .eq(lines.reduce((sum: Prisma.Decimal, line: { haber: Prisma.Decimal }) => sum.plus(line.haber), new Prisma.Decimal(0)))
    ).toBe(true);
  });

  it('rechaza un cierre previo sin línea de resultado si el resultado del período no es cero', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(0), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(0),
      saldoResultadoAcumInicial: new Prisma.Decimal(0) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ asientoId: 'close-p1' });
    db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
      'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
      rol, cuenta: { cuentaContableId: `${rol}-id` },
    })));
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'ingreso', debe: new Prisma.Decimal(7), haber: new Prisma.Decimal(0) },
      { cuentaId: 'gasto', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(7) },
    ]);
    db.asientoLinea.groupBy.mockResolvedValue([{ cuentaId: 'ingreso', _sum: {
      debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(7),
    } }]);
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('permite abrir tras un período aprobado sin movimientos de resultado como cero explícito', async () => {
    db.aperturaPeriodo.findFirst.mockResolvedValue({ periodoId: 'p2', tenantId: 't1', origenPeriodoId: 'p1',
      saldoCajaInicial: new Prisma.Decimal(100), saldoBancoInicial: new Prisma.Decimal(0),
      saldoCuentasCobrarInicial: new Prisma.Decimal(0), saldoCuentasPagarInicial: new Prisma.Decimal(0),
      saldoInventarioInicial: new Prisma.Decimal(0), saldoCapitalInicial: new Prisma.Decimal(100),
      saldoResultadoAcumInicial: new Prisma.Decimal(0) });
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 't1',
      fechaFin: new Date('2026-01-31'), estado: 'APROBADO', tipo: 'MENSUAL' });
    db.asiento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    db.cuentaRolTenant.findMany.mockResolvedValue(['CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES',
      'INVENTARIOS', 'CAPITAL_SOCIAL', 'RESULTADO_PERIODO', 'RESULTADOS_ACUMULADOS'].map((rol) => ({
      rol, cuenta: { cuentaContableId: `${rol}-id` },
    })));
    db.asientoLinea.groupBy.mockResolvedValue([]);
    const result = await generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    expect(result.estado).toBe('CONTABILIZADO');
    expect(db.asiento.create).toHaveBeenCalledTimes(1);
    expect(db.asientoLinea.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza resultados acumulados de cierre con importe distinto al Decimal recomputado', async () => {
    prepararAperturaValidacion('p1', '10', '3', '0', '8');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
    expect(db.asiento.create).not.toHaveBeenCalled();
  });

  it('rechaza signo incorrecto para utilidad y pérdida', async () => {
    prepararAperturaValidacion('p1', '10', '3', '7', '0');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();

    vi.resetAllMocks();
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    db.asiento.findFirst.mockResolvedValue(null);
    db.asiento.create.mockResolvedValue({ asientoId: 'cierre-1' });
    db.diario.findFirst.mockResolvedValue({ diarioId: 'diario-1' });
    db.cuentaContable.findMany.mockResolvedValue([
      { cuentaContableId: 'ingreso', tipo: 'INGRESO' },
      { cuentaContableId: 'gasto', tipo: 'GASTO' },
    ]);
    db.periodoContable.findUnique.mockResolvedValue({ periodoId: 'p2', tenantId: 't1',
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-28'), tipo: 'MENSUAL' });
    prepararAperturaValidacion('p1', '3', '10', '0', '7');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('rechaza importe no cero transferido cuando el resultado recomputado es cero', async () => {
    prepararAperturaValidacion('p1', '5', '5', '0', '1');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('rechaza línea de resultado con debe y haber simultáneamente no cero', async () => {
    prepararAperturaValidacion('p1', '10', '3', '7', '7');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('requiere que apertura.origenPeriodoId identifique el predecesor inmediato', async () => {
    prepararAperturaValidacion('older-period', '10', '3', '0', '7');
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('rechaza solapamiento aunque exista un predecesor exacto anterior', async () => {
    prepararAperturaValidacion('p1', '10', '3', '0', '7');
    db.periodoContable.findMany.mockResolvedValue([{ periodoId: 'overlap', tenantId: 't1',
      fechaInicio: new Date('2026-01-15'), fechaFin: new Date('2026-02-10'), tipo: 'MENSUAL' }]);
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow('Existe un período contable solapado');
    expect(db.periodoContable.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        tipo: 'MENSUAL',
        periodoId: { not: 'p2' },
        fechaInicio: { lte: new Date('2026-02-28') },
        fechaFin: { gte: new Date('2026-02-01') },
      },
      select: { periodoId: true },
      take: 1,
    });
  });

  it('rechaza cierres previos con más de una línea de RESULTADO_PERIODO', async () => {
    prepararAperturaValidacion('p1', '10', '3', '0', '7');
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'income', debe: new Prisma.Decimal(10), haber: new Prisma.Decimal(0) },
      { cuentaId: 'expense', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(3) },
      { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(7) },
      { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(0) },
    ]);
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('rechaza cierre previo cuyo asiento completo no cuadra', async () => {
    prepararAperturaValidacion('p1', '10', '3', '0', '7');
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'income', debe: new Prisma.Decimal(10), haber: new Prisma.Decimal(0) },
      { cuentaId: 'expense', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(3) },
      { cuentaId: 'RESULTADO_PERIODO-id', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(6) },
    ]);
    await expect(generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') })).rejects.toThrow();
  });

  it('acepta cierre cero balanceado sin línea RESULTADO_PERIODO', async () => {
    prepararAperturaValidacion('p1', '5', '5', '0', '0');
    db.asientoLinea.findMany.mockResolvedValue([
      { cuentaId: 'ingreso', debe: new Prisma.Decimal(5), haber: new Prisma.Decimal(0) },
      { cuentaId: 'gasto', debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(5) },
    ]);
    const result = await generarAsientoApertura(db as never, { periodoId: 'p2', tenantId: 't1', actorId: 'u1',
      fecha: new Date('2026-02-01') });
    expect(result.estado).toBe('CONTABILIZADO');
    expect(db.asiento.create.mock.calls[0][0].data.lineas.create).toHaveLength(2);
  });
});
