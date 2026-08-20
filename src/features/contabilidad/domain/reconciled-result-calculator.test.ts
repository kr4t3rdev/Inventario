import { describe, expect, it } from 'vitest';

import {
  calculateReconciledResult,
  getYearRangeInTimeZone,
  type ReconciledResultMovement,
} from '@/features/contabilidad/domain/reconciled-result-calculator';

const DEFAULT_INPUT = {
  year: 2025,
  timeZone: 'America/Havana',
  functionalCurrency: 'CUP',
  movements: [] as ReconciledResultMovement[],
  shrinkages: [],
};

describe('calculateReconciledResult', () => {
  it('solo reconoce ventas y servicios contabilizados como ingreso operativo', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'sale',
          id: 'sale-posted',
          kind: 'SALE',
          status: 'POSTED',
          occurredAt: '2025-01-10T15:00:00Z',
          amount: 600,
          document: { id: 'sale-1', revenue: 1000, historicalCost: 400, estimatedCost: 0 },
        },
        {
          source: 'service',
          id: 'service-posted',
          kind: 'SERVICE_SALE',
          status: 'POSTED',
          occurredAt: '2025-01-11T15:00:00Z',
          amount: 300,
          document: { id: 'service-1', revenue: 300, historicalCost: 80, estimatedCost: 0 },
        },
        {
          source: 'sale',
          id: 'sale-pending',
          kind: 'SALE',
          status: 'PENDING',
          occurredAt: '2025-01-12T15:00:00Z',
          amount: 500,
          document: { id: 'sale-2', revenue: 500, historicalCost: 200, estimatedCost: 0 },
        },
      ],
    });

    expect(result.annual.income).toEqual({ sales: 600, services: 300, total: 900 });
    expect(result.annual.costOfSales.total).toBe(320);
    expect(result.annual.grossMargin).toBe(580);
  });

  it('mantiene préstamos y deuda fuera del ingreso operativo', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'financial',
          id: 'loan-payment',
          kind: 'CASH_LOAN_PAYMENT',
          status: 'POSTED',
          occurredAt: '2025-02-10T12:00:00Z',
          amount: 200,
        },
        {
          source: 'financial',
          id: 'debt-disbursement',
          kind: 'CASH_DEBT_DISBURSEMENT',
          status: 'POSTED',
          occurredAt: '2025-02-11T12:00:00Z',
          amount: 500,
        },
      ],
    });

    expect(result.annual.income.total).toBe(0);
    expect(result.annual.reconciledResult).toBe(0);
    expect(result.annual.cashFlow.financial).toBe(700);
    expect(result.annual.cashFlow.net).toBe(700);
  });

  it('limita pagos parciales al total del documento y reporta el excedente', () => {
    const document = { id: 'sale-1', revenue: 1000, historicalCost: 400, estimatedCost: 0 };
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'sale', id: 'p1', kind: 'SALE', status: 'PARTIAL',
          occurredAt: '2025-01-10T12:00:00Z', amount: 700, document,
        },
        {
          source: 'sale', id: 'p2', kind: 'SALE', status: 'POSTED',
          occurredAt: '2025-02-10T12:00:00Z', amount: 500, document,
        },
      ],
    });

    expect(result.annual.income.sales).toBe(1000);
    expect(result.annual.costOfSales.total).toBe(400);
    expect(result.monthly[0].income.sales).toBe(700);
    expect(result.monthly[1].income.sales).toBe(300);
    expect(result.incidents).toContainEqual({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
      movementId: 'p2',
      affectedAmount: 200,
    });
  });

  it('considera cobros de años anteriores al limitar el saldo del documento', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      openingRecognitions: [{ source: 'sale', documentId: 'sale-1', amount: 800 }],
      movements: [{
        source: 'sale', id: 'current-payment', kind: 'SALE', status: 'POSTED',
        occurredAt: '2025-02-10T12:00:00Z', amount: 500,
        document: { id: 'sale-1', revenue: 1000, historicalCost: 400, estimatedCost: 0 },
      }],
    });

    expect(result.annual.income.sales).toBe(200);
    expect(result.annual.costOfSales.total).toBe(80);
    expect(result.incidents).toContainEqual({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
      movementId: 'current-payment',
      affectedAmount: 300,
    });
  });

  it('separa el fallback de costo actual como estimación proporcional', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [{
        source: 'sale',
        id: 'sale-estimated',
        kind: 'SALE',
        status: 'POSTED',
        occurredAt: '2025-03-10T12:00:00Z',
        amount: 500,
        document: { id: 'sale-1', revenue: 1000, historicalCost: 300, estimatedCost: 100 },
      }],
    });

    expect(result.annual.costOfSales).toEqual({
      productsHistorical: 150,
      productsEstimated: 50,
      services: 0,
      total: 200,
    });
    expect(result.estimates).toEqual([{
      code: 'CURRENT_COST_FALLBACK',
      movementId: 'sale-estimated',
      affectedAmount: 50,
    }]);
  });

  it('reconoce costo de servicio una vez y no duplica su pago como gasto', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'service',
          id: 'service-income',
          kind: 'SERVICE_SALE',
          status: 'POSTED',
          occurredAt: '2025-04-10T12:00:00Z',
          amount: 500,
          document: { id: 'service-1', revenue: 500, historicalCost: 120, estimatedCost: 0 },
        },
        {
          source: 'expense',
          id: 'service-cost-payment',
          kind: 'SOLD_SERVICE_COST',
          status: 'POSTED',
          occurredAt: '2025-04-11T12:00:00Z',
          amount: 120,
          documentId: 'service-1',
          documentAmount: 120,
        },
      ],
    });

    expect(result.annual.costOfSales.services).toBe(120);
    expect(result.annual.operatingExpenses.total).toBe(0);
    expect(result.annual.reconciledResult).toBe(380);
    expect(result.annual.cashFlow.operating).toBe(380);
  });

  it('lleva compras a caja, suma salario pagado y separa mermas no monetarias', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'expense', id: 'purchase', kind: 'INVENTORY_PURCHASE', status: 'POSTED',
          occurredAt: '2025-05-10T12:00:00Z', amount: 300,
          documentId: 'purchase-1', documentAmount: 300,
        },
        {
          source: 'expense', id: 'salary', kind: 'SALARY_EXPENSE', status: 'POSTED',
          occurredAt: '2025-05-11T12:00:00Z', amount: 650,
          documentId: 'salary-1', documentAmount: 650,
        },
      ],
      shrinkages: [{ id: 'loss-1', occurredAt: '2025-05-12T12:00:00Z', amount: 90 }],
    });

    expect(result.annual.operatingExpenses).toEqual({
      salaries: 650,
      general: 0,
      purchasedServices: 0,
      total: 650,
    });
    expect(result.annual.inventoryPurchases).toBe(300);
    expect(result.annual.nonCashAdjustments.shrinkages).toBe(90);
    expect(result.annual.reconciledResult).toBe(-650);
    expect(result.annual.cashFlow.operating).toBe(-950);
  });

  it('limita un gasto en moneda original y reconoce su equivalente funcional', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      openingRecognitions: [{
        source: 'expense',
        kind: 'RECEIVED_SERVICE_EXPENSE',
        documentId: 'foreign-service',
        amount: 100,
      }],
      movements: [{
        source: 'expense',
        id: 'foreign-payment',
        kind: 'RECEIVED_SERVICE_EXPENSE',
        status: 'POSTED',
        occurredAt: '2025-06-10T12:00:00Z',
        amount: 2400,
        capAmount: 100,
        documentId: 'foreign-service',
        documentAmount: 150,
      }],
    });

    expect(result.annual.operatingExpenses.purchasedServices).toBe(1200);
    expect(result.incidents).toContainEqual({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
      movementId: 'foreign-payment',
      affectedAmount: 1200,
    });
  });

  it('construye el anual sumando exactamente los doce meses, incluido COGS', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [
        {
          source: 'sale', id: 'jan', kind: 'SALE', status: 'POSTED',
          occurredAt: '2025-01-15T12:00:00Z', amount: 100,
          document: { id: 'jan-sale', revenue: 100, historicalCost: 30, estimatedCost: 0 },
        },
        {
          source: 'sale', id: 'dec', kind: 'SALE', status: 'POSTED',
          occurredAt: '2026-01-01T04:30:00Z', amount: 200,
          document: { id: 'dec-sale', revenue: 200, historicalCost: 70, estimatedCost: 0 },
        },
      ],
    });

    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[11].income.sales).toBe(200);
    expect(result.annual.income.total).toBe(
      result.monthly.reduce((total, month) => total + month.income.total, 0),
    );
    expect(result.annual.costOfSales.total).toBe(
      result.monthly.reduce((total, month) => total + month.costOfSales.total, 0),
    );
  });

  it('excluye del año un instante que todavía pertenece a diciembre local anterior', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [{
        source: 'sale', id: 'outside', kind: 'SALE', status: 'POSTED',
        occurredAt: '2025-01-01T04:30:00Z', amount: 100,
        document: { id: 'outside-sale', revenue: 100, historicalCost: 20, estimatedCost: 0 },
      }],
    });

    expect(result.annual.income.total).toBe(0);
  });

  it('reporta movimientos y mermas inválidos en vez de descartarlos silenciosamente', () => {
    const result = calculateReconciledResult({
      ...DEFAULT_INPUT,
      movements: [{
        source: 'financial', id: 'bad-date', kind: 'CASH_LOAN_PAYMENT', status: 'POSTED',
        occurredAt: 'fecha-invalida', amount: 100,
      }],
      shrinkages: [
        { id: 'bad-loss-date', occurredAt: 'fecha-invalida', amount: 20 },
        { id: 'bad-loss-amount', occurredAt: '2025-01-10T12:00:00Z', amount: -5 },
      ],
    });

    expect(result.incidents).toEqual([
      { code: 'INVALID_DATE', movementId: 'bad-date', affectedAmount: 100 },
      { code: 'INVALID_DATE', movementId: 'bad-loss-date', affectedAmount: 20 },
      { code: 'INVALID_AMOUNT', movementId: 'bad-loss-amount', affectedAmount: 0 },
    ]);
  });
});

describe('getYearRangeInTimeZone', () => {
  it('crea un rango semiabierto respetando el desfase de America/Havana', () => {
    expect(getYearRangeInTimeZone(2025, 'America/Havana')).toEqual({
      gte: new Date('2025-01-01T05:00:00.000Z'),
      lt: new Date('2026-01-01T05:00:00.000Z'),
    });
  });
});
