import { describe, expect, it } from 'vitest';

import {
  ACCOUNTING_FEATURE_KEYS,
  mergeAccountingFeatures,
  pickAccountingFeatures,
  PLAN_ACCOUNTING_FEATURES_BY_NAME,
} from '../backfill-accounting-features';
import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from '../plans-seed';

describe('backfill-accounting-features', () => {
  it('incluye reportes-financieros dentro del subset financiero del plan Básico', () => {
    const basicAccountingFeatures = pickAccountingFeatures(PLAN_BASICO_FEATURES);

    expect(basicAccountingFeatures['reportes-financieros']).toBe(true);
    expect(basicAccountingFeatures['transferencias-bancarias']).toBe(false);
    expect(basicAccountingFeatures['ajustes-bancarios']).toBe(false);
  });

  it('sincroniza el subset financiero esperado por plan', () => {
    expect(PLAN_ACCOUNTING_FEATURES_BY_NAME['Básico']).toEqual(
      pickAccountingFeatures(PLAN_BASICO_FEATURES),
    );
    expect(PLAN_ACCOUNTING_FEATURES_BY_NAME.Profesional).toEqual(
      pickAccountingFeatures(PLAN_PROFESIONAL_FEATURES),
    );
    expect(PLAN_ACCOUNTING_FEATURES_BY_NAME.Empresarial).toEqual(
      pickAccountingFeatures(PLAN_EMPRESARIAL_FEATURES),
    );
  });

  it('mergea los flags financieros sin borrar features no relacionadas', () => {
    const merged = mergeAccountingFeatures(
      {
        productos: true,
        'reportes-financieros': false,
        'transferencias-bancarias': true,
      },
      'Básico',
    );

    expect(merged).toMatchObject({
      productos: true,
      'reportes-financieros': true,
      'transferencias-bancarias': false,
      'ajustes-bancarios': false,
      contabilidad: true,
    });
  });

  it('omite planes desconocidos', () => {
    expect(mergeAccountingFeatures({ productos: true }, 'Custom')).toBeNull();
  });

  it('mantiene estable el catálogo de keys financieros del backfill', () => {
    expect(ACCOUNTING_FEATURE_KEYS).toEqual([
      'gastos',
      'contabilidad',
      'transferencias-bancarias',
      'ajustes-bancarios',
      'multi-moneda',
      'rentabilidad-compra',
      'inyeccion-capital',
      'reportes-financieros',
      'cuentas-cobrar',
      'cuentas-pagar',
      'prestamos-cash',
      'deudas-cash',
      'anticipos',
      'analisis-estado-cuenta',
      'facturas-vencidas',
    ]);
  });
});
