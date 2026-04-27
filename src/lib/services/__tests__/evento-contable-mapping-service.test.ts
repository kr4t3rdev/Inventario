import { describe, expect, it } from 'vitest';

import { ORIGEN_TIPO } from '@/lib/services/evento-contable-service';
import { enriquecerEventoConCuentas, resolverCuentaContableMapping } from '@/lib/services/evento-contable-mapping-service';

describe('evento-contable-mapping-service', () => {
  it('resuelve cuentas estables para ventas', () => {
    const mapping = resolverCuentaContableMapping(ORIGEN_TIPO.VENTA);
    expect(mapping.cuentaPrincipal).toBe('INGRESOS_POR_VENTAS');
    expect(mapping.cuentaContraria).toBe('CUENTAS_POR_COBRAR');
  });

  it('resuelve cuentas estables para cobros de venta', () => {
    const mapping = resolverCuentaContableMapping(ORIGEN_TIPO.COBRO_VENTA);
    expect(mapping.cuentaPrincipal).toBe('CAJA');
    expect(mapping.cuentaContraria).toBe('CUENTAS_POR_COBRAR');
  });

  it('enriquece una semilla con cuentas y etiqueta contable', () => {
    const evento = enriquecerEventoConCuentas({
      fechaOperacion: new Date('2026-04-25T10:00:00.000Z'),
      origenTipo: ORIGEN_TIPO.GASTO_DE,
      origenId: 'gasto-1',
      monto: 1500,
    });

    expect(evento.cuentaPrincipal).toBe('GASTOS_DE_EXPLOTACION');
    expect(evento.cuentaContraria).toBe('CAJA');
    expect(evento.etiquetaContable).toBe('Gasto de explotación');
    expect(evento.criterio).toBe('DEVENGO');
    expect(evento.naturaleza).toBe('EGRESO');
  });
});
