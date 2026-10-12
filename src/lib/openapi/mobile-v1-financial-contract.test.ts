import { describe, expect, it } from 'vitest';

import { loadMobileV1Contract } from '@/lib/openapi/contract-guards';

/**
 * Paridad de los contratos financieros sensibles de mobile v1 con el servicio real.
 *
 * Fase 1 del plan de reconciliación OpenAPI: los schemas de request deben aceptar
 * exactamente lo que valida el servicio (Zod) y los de response deben describir lo
 * que la ruta realmente retorna. Los campos de idempotencia solo se publican cuando
 * existe implementación respaldada en main.
 */
describe('mobile v1 financial contract parity', () => {
  it('alinea CapitalInjectionCreateRequest con el schema del servicio', async () => {
    const contract = await loadMobileV1Contract();
    const schema = contract.components.schemas.CapitalInjectionCreateRequest as Record<string, any>;

    expect(schema.properties).toEqual({
      montoRecibido: { type: 'number', exclusiveMinimum: 0 },
      moneda: { type: 'string', default: 'CUP', minLength: 1 },
      tipo: { type: 'string', enum: ['CAPITAL_SOCIAL', 'DEUDA_EXTERNA'] },
      cuentaId: { type: 'string', minLength: 1 },
      descripcion: { type: 'string', minLength: 1 },
      socio: { type: 'string', minLength: 1 },
      entidadPrestamista: { type: 'string', minLength: 1 },
      tasaInteres: { type: 'number', minimum: 0 },
      plazoMeses: { type: 'integer', exclusiveMinimum: 0 },
      fechaInicioPago: { type: 'string', format: 'date-time' },
      fechaOperacion: { type: 'string', format: 'date-time' },
    });
    expect(schema.required).toEqual(['montoRecibido', 'tipo', 'cuentaId']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('describe la respuesta real del alta de capital (fila de InyeccionCapital)', async () => {
    const contract = await loadMobileV1Contract();
    const response = contract.paths['/accounting/capital-injections'].post.responses['200']
      .content['application/json'].schema as { $ref: string };
    const schema = contract.components.schemas[response.$ref.split('/').at(-1)] as Record<string, any>;

    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining([
      'id', 'tenantId', 'tipo', 'montoRecibido', 'moneda', 'tasaInteres', 'montoInteres',
      'montoTotalDeuda', 'saldoPendiente', 'plazoMeses', 'fechaInicioPago', 'socio',
      'entidadPrestamista', 'cuentaId', 'estado', 'descripcion', 'fechaRegistro',
      'createdAt', 'updatedAt',
    ]));
    expect(schema.properties.montoRecibido.type).toBe('string');
    expect(schema.required).toEqual(expect.arrayContaining([
      'id', 'tipo', 'montoRecibido', 'moneda', 'cuentaId', 'fechaRegistro',
    ]));
    expect(Object.keys(schema.properties)).not.toContain('inyeccionId');
    expect(Object.keys(schema.properties)).not.toContain('cuentaBancariaId');
  });

  it('alinea BankAdjustmentRequest con el schema del servicio', async () => {
    const contract = await loadMobileV1Contract();
    const schema = contract.components.schemas.BankAdjustmentRequest as Record<string, any>;

    expect(schema.properties.monto).toEqual({ type: 'number', exclusiveMinimum: 0 });
    expect(schema.properties.tasaCambio).toEqual({ type: 'number', exclusiveMinimum: 0 });
    expect(schema.properties.fechaOperacion).toEqual({ type: 'string', format: 'date-time' });
    expect(schema.properties.moneda).toEqual({ type: 'string', default: 'CUP', minLength: 1 });
    expect(schema.required).toEqual(['cuentaId', 'tipo', 'monto', 'descripcion', 'motivo']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('describe el envelope real del alta de ajuste bancario', async () => {
    const contract = await loadMobileV1Contract();
    const response = contract.paths['/accounting/bank-adjustments'].post.responses['200']
      .content['application/json'].schema as { $ref: string };
    const schema = contract.components.schemas[response.$ref.split('/').at(-1)] as Record<string, any>;

    expect(Object.keys(schema.properties)).toEqual([
      'ajuste', 'saldoAnterior', 'saldoNuevo', 'advertenciaSaldoNegativo', 'message',
    ]);
    expect(schema.required).toEqual([
      'ajuste', 'saldoAnterior', 'saldoNuevo', 'advertenciaSaldoNegativo', 'message',
    ]);
    const ajusteRef = schema.properties.ajuste.$ref as string;
    const ajuste = contract.components.schemas[ajusteRef.split('/').at(-1)] as Record<string, any>;
    expect(Object.keys(ajuste.properties)).toEqual(expect.arrayContaining([
      'ajusteId', 'tenantId', 'cuentaId', 'tipo', 'monto', 'moneda', 'tasaCambio',
      'montoConvertido', 'descripcion', 'motivo', 'realizadoPor', 'fechaOperacion',
      'createdAt', 'updatedAt',
    ]));
    expect(ajuste.properties.monto.type).toBe('string');
  });

  it('solo publica idempotencyKey donde main tiene implementación respaldada', async () => {
    const contract = await loadMobileV1Contract();

    for (const name of [
      'BankAdjustmentRequest',
      'CapitalInjectionCreateRequest',
      'CashLoanCreateRequest',
      'CashDebtCreateRequest',
      'CashPaymentRequest',
      'ServiceReconciliationRequest',
    ]) {
      const schema = contract.components.schemas[name] as Record<string, any>;
      expect(Object.keys(schema.properties), name).not.toContain('idempotencyKey');
    }

    const anticipos = contract.components.schemas
      .AccountingAdvancesIdEjecutarPostRequest as Record<string, any>;
    expect(Object.keys(anticipos.properties)).toContain('idempotencyKey');
  });

  it('cierra los request schemas de units que el merge dejó abiertos', async () => {
    const contract = await loadMobileV1Contract();
    const create = contract.paths['/units/create'].post.requestBody
      .content['application/json'].schema as Record<string, any>;
    const update = contract.paths['/units/{id}'].put.requestBody
      .content['application/json'].schema as Record<string, any>;

    expect(create.additionalProperties).toBe(false);
    expect(update.additionalProperties).toBe(false);
  });
});
