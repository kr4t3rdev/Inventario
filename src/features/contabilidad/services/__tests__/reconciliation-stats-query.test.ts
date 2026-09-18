import { describe, expect, it } from 'vitest';

import { buildPendingSalesCountQuery } from '../reconciliation-stats-query';

function renderSql(query: { strings: readonly string[]; values: readonly unknown[] }): string {

  return query.strings.reduce(
    (rendered, part, index) =>
      `${rendered}${part}${index < query.values.length ? `$${index + 1}` : ''}`,
    '',
  );
}

describe('reconciliation stats pending sales query', () => {
  it('builds a parameterized tenant-safe predicate for canonical and legacy CxC links', () => {
    const query = buildPendingSalesCountQuery('tenant-a');
    const renderedQuery = renderSql(query);

    expect(renderedQuery).toContain('NOT EXISTS');
    expect(renderedQuery).toContain('"CuentaPorCobrar" cxc');
    expect(renderedQuery).toContain('cxc."facturaId" = f."idFactura"');
    expect(renderedQuery).toContain('cxc."facturaId" = v."ventaId"');
    expect(renderedQuery).toContain('cxc."estado" IN');
    expect(renderedQuery).toContain('cxc."tenantId" = $');
    expect(renderedQuery).toContain('f."tenantId" = $');
    expect(renderedQuery).toContain('v."tenantId" = $');
    expect(renderedQuery).toContain('rv."tenantId" = $');
    expect(query.values.filter((value) => value === 'tenant-a')).toHaveLength(4);
    expect(query.values).toEqual(expect.arrayContaining(['PENDIENTE', 'PARCIAL']));
    expect(renderedQuery).not.toContain('"PAGADA"');
    expect(renderedQuery).not.toContain('"ANULADA"');
    expect(query.values).not.toContain('PENDIENTE OR PARCIAL');
  });

  it('prefers persisted converted reconciliation amounts before currency fallback', () => {
    const renderedQuery = renderSql(buildPendingSalesCountQuery('tenant-a'));

    expect(renderedQuery).toContain('COALESCE(rv."montoConvertido", CASE');
    expect(renderedQuery).toContain('rv."monto" * rv."tasaCambio"');
  });

  it('rejects an empty tenant before constructing a query', () => {
    expect(() => buildPendingSalesCountQuery('')).toThrow(/tenant/i);
    expect(() => buildPendingSalesCountQuery('   ')).toThrow(/tenant/i);
  });
});
