import { describe, expect, it } from 'vitest';

import { buildMovementsReportQuery } from './movements-report-query';

describe('buildMovementsReportQuery', () => {
  it('normalizes every enabled accounting source and aggregates before pagination', () => {
    const query = buildMovementsReportQuery({ tenantId: 'tenant-1', page: 2, limit: 25 });

    expect(query.text).toContain('FROM "ReconciliacionVenta"');
    expect(query.text).toContain('FROM "ReconciliacionServicio"');
    expect(query.text).toContain('FROM "ReconciliacionGasto"');
    expect(query.text).toContain('FROM "TransferenciaBancaria"');
    expect(query.text).toContain('FROM "AjusteBancario"');
    expect(query.text).toContain('FROM "InyeccionCapital"');
    expect(query.text).toContain('FROM "PagoDeuda"');
    expect(query.text).toContain('totals_by_currency AS');
    expect(query.text).toMatch(/FROM filtered[\s\S]+GROUP BY moneda/);
    expect(query.text).toMatch(/paged AS[\s\S]+LIMIT \$\d+[\s\S]+OFFSET \$\d+/);
    expect(query.values.slice(-2)).toEqual([25, 25]);
  });

  it('calculates conversion coverage over filtered sales, services and expenses only', () => {
    const query = buildMovementsReportQuery({ tenantId: 'tenant-1' });

    expect(query.text).toContain('conversion_coverage AS');
    expect(query.text).toContain('WHERE "coverageEligible"');
    expect(query.text).toContain("'normalized'");
    expect(query.text).toContain("'legacyUnproven'");
    expect(query.text).toContain("'unresolved'");
    expect(query.text).toContain("'percentage'");
    expect(query.text).toContain('AS "coberturaConversion"');
  });

  it('serializes paged movement dates as explicit ISO UTC values', () => {
    const query = buildMovementsReportQuery({ tenantId: 'tenant-1' });

    expect(query.text).toContain('to_char(paged.fecha,');
    expect(query.text).not.toContain("paged.fecha AT TIME ZONE 'UTC'");
    expect(query.text).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    expect(query.text).toContain("|| jsonb_build_object('fecha'");
  });

  it('parameterizes tenant, search and filters instead of interpolating user input', () => {
    const hostileSearch = "x%' OR TRUE --";
    const query = buildMovementsReportQuery({
      tenantId: 'tenant-secure',
      busqueda: hostileSearch,
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-31',
      cuentaId: 'account-1',
      moneda: 'USD',
      tipoMovimiento: 'gasto',
    });

    expect(query.text).not.toContain(hostileSearch);
    expect(query.values).toContain('tenant-secure');
    expect(query.values).toContain(`%${hostileSearch}%`);
    expect(query.values).toContain('account-1');
    expect(query.values).toContain('USD');
    expect(query.values).toContain('gasto');
    // Límites zonalizados: agosto en America/Havana está en DST (UTC-4).
    expect(query.values).toContainEqual(new Date('2026-08-01T04:00:00.000Z'));
    expect(query.values).toContainEqual(new Date('2026-09-01T04:00:00.000Z'));
  });

  it('cierra el día civil en la zona contable, no en medianoche UTC', () => {
    const query = buildMovementsReportQuery({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-15',
      fechaFin: '2026-01-31',
    });

    // Enero en America/Havana está en hora estándar (UTC-5).
    expect(query.values).toContainEqual(new Date('2026-01-15T05:00:00.000Z'));
    expect(query.values).toContainEqual(new Date('2026-02-01T05:00:00.000Z'));
    expect(query.values).not.toContainEqual(new Date('2026-01-15T00:00:00.000Z'));
  });

  it('prunes sources disabled by plan capabilities', () => {
    const query = buildMovementsReportQuery({
      tenantId: 'tenant-1',
      includeServicios: false,
      includeTransfers: false,
      includeAdjustments: false,
      includeCapital: false,
      includePrestamosCash: false,
      includeDeudasCash: false,
    });

    expect(query.text).not.toContain('FROM "ReconciliacionServicio"');
    expect(query.text).not.toContain('FROM "TransferenciaBancaria"');
    expect(query.text).not.toContain('FROM "AjusteBancario"');
    expect(query.text).not.toContain('FROM "InyeccionCapital"');
    expect(query.text).not.toContain('FROM "PagoDeuda"');
    expect(query.text).toContain('FROM "ReconciliacionVenta"');
    expect(query.text).toContain('FROM "ReconciliacionGasto"');
    expect(query.text).toContain('NOT IN');
  });

  it('loads only the source capable of producing a requested movement type', () => {
    const query = buildMovementsReportQuery({
      tenantId: 'tenant-1',
      tipoMovimiento: 'ajuste_ingreso',
    });

    expect(query.text).toContain('FROM "AjusteBancario"');
    expect(query.text).not.toContain('FROM "ReconciliacionVenta"');
    expect(query.text).not.toContain('FROM "TransferenciaBancaria"');
  });

  it('clamps unsafe pagination values', () => {
    const query = buildMovementsReportQuery({ tenantId: 'tenant-1', page: -4, limit: 50_000 });

    expect(query.values.slice(-2)).toEqual([100, 0]);
  });

  it('rejects invalid civil dates before building SQL', () => {
    expect(() => buildMovementsReportQuery({
      tenantId: 'tenant-1',
      fechaInicio: 'not-a-date',
    })).toThrow('fechaInicio');
  });
});
