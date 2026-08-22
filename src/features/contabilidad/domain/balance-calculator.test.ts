import { describe, expect, it } from 'vitest';

import {
  calculateCurrentBalance,
  type CalculateCurrentBalanceInput,
} from '@/features/contabilidad/domain/balance-calculator';

const BASE_INPUT: CalculateCurrentBalanceInput = {
  asOf: '2026-08-20T12:00:00.000Z',
  functionalCurrency: 'CUP',
  bankBalances: [],
  inventory: [],
  receivables: [],
  payables: [],
  externalDebts: [],
  capitalContributions: [],
  approvedClosures: [],
  currentResult: 0,
  unresolvedParts: [],
};

describe('calculateCurrentBalance', () => {
  it('reconstruye un balance cuadrado desde todas sus partidas', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      bankBalances: [{ id: 'bank-1', amount: 1000 }],
      inventory: [{
        id: 'product-1',
        quantity: 10,
        historicalLayers: [{ quantity: 8, unitCost: 20 }],
        fallbackUnitCost: 30,
      }],
      receivables: [{ id: 'ar-1', debt: 500, paid: 200, state: 'PARCIAL' }],
      payables: [{
        id: 'ap-1',
        pendingBalance: 400,
        state: 'PENDIENTE',
        deleted: false,
      }],
      externalDebts: [{ id: 'debt-1', pendingBalance: 300, state: 'ACTIVA' }],
      capitalContributions: [{
        id: 'capital-1',
        amount: 500,
        registeredAt: '2026-01-01T12:00:00Z',
      }],
      approvedClosures: [{
        id: 'closure-1',
        type: 'anual',
        state: 'aprobado',
        approvedBy: 'user-1',
        endedAt: '2025-12-31T23:59:59Z',
        gains: 200,
        losses: 50,
      }],
      currentResult: 170,
    });

    expect(result.assets).toEqual({
      cashAndBanks: 1000,
      inventory: { historical: 160, estimated: 60, total: 220 },
      receivables: 300,
      total: 1520,
    });
    expect(result.liabilities).toEqual({ payables: 400, externalDebt: 300, total: 700 });
    expect(result.equity).toEqual({
      capital: 500,
      retainedEarnings: 150,
      currentResult: 170,
      total: 820,
    });
    expect(result.equation).toEqual({
      assets: 1520,
      liabilitiesAndEquity: 1520,
      difference: 0,
      status: 'CUADRADO',
    });
  });

  it('filtra estados inactivos y limita saldos negativos de CxC y CxP', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      receivables: [
        { id: 'active', debt: 100, paid: 25, state: 'PENDIENTE' },
        { id: 'overpaid', debt: 50, paid: 80, state: 'PARCIAL' },
        { id: 'paid', debt: 90, paid: 0, state: 'PAGADA' },
        { id: 'voided', debt: 90, paid: 0, state: 'ANULADA' },
      ],
      payables: [
        { id: 'active', pendingBalance: 70, state: 'PARCIAL', deleted: false },
        { id: 'negative', pendingBalance: -10, state: 'PENDIENTE', deleted: false },
        { id: 'paid', pendingBalance: 90, state: 'PAGADA', deleted: false },
        { id: 'deleted', pendingBalance: 90, state: 'PENDIENTE', deleted: true },
      ],
    });

    expect(result.assets.receivables).toBe(75);
    expect(result.liabilities.payables).toBe(70);
    expect(result.incidents).toEqual(expect.arrayContaining([
      { code: 'NEGATIVE_RECEIVABLE_BALANCE', itemId: 'overpaid', affectedAmount: 30 },
      { code: 'NEGATIVE_PAYABLE_BALANCE', itemId: 'negative', affectedAmount: 10 },
    ]));
  });

  it('usa deuda pendiente activa y excluye deuda pagada', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      externalDebts: [
        { id: 'active', pendingBalance: 100, state: 'ACTIVA' },
        { id: 'late', pendingBalance: 40, state: 'EN_MORA' },
        { id: 'paid', pendingBalance: 200, state: 'PAGADA' },
      ],
    });

    expect(result.liabilities.externalDebt).toBe(140);
  });

  it('respeta fecha de corte para capital y cierres anuales aprobados', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      capitalContributions: [
        { id: 'before', amount: 100, registeredAt: '2026-01-01T00:00:00Z' },
        { id: 'after', amount: 500, registeredAt: '2026-09-01T00:00:00Z' },
      ],
      approvedClosures: [
        {
          id: 'approved', type: 'ANUAL', state: 'APROBADO', approvedBy: 'user-1',
          endedAt: '2025-12-31T23:59:59Z', gains: 90, losses: 20,
        },
        {
          id: 'draft', type: 'anual', state: 'borrador', approvedBy: null,
          endedAt: '2024-12-31T23:59:59Z', gains: 900, losses: 0,
        },
        {
          id: 'monthly', type: 'mensual', state: 'aprobado', approvedBy: 'user-1',
          endedAt: '2025-11-30T23:59:59Z', gains: 900, losses: 0,
        },
        {
          id: 'future', type: 'anual', state: 'aprobado', approvedBy: 'user-1',
          endedAt: '2026-09-30T23:59:59Z', gains: 900, losses: 0,
        },
      ],
    });

    expect(result.equity.capital).toBe(100);
    expect(result.equity.retainedEarnings).toBe(70);
  });

  it('no duplica cierres anuales aprobados del mismo ejercicio', () => {
    const duplicateClosure = {
      type: 'anual',
      state: 'aprobado',
      approvedBy: 'user-1',
      endedAt: '2025-12-31T23:59:59Z',
      gains: 100,
      losses: 20,
    };
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      approvedClosures: [
        { id: 'closure-1', ...duplicateClosure },
        { id: 'closure-2', ...duplicateClosure },
      ],
    });

    expect(result.equity.retainedEarnings).toBe(0);
    expect(result.incidents).toContainEqual({
      code: 'DUPLICATE_ANNUAL_CLOSURE',
      itemId: '2025',
      affectedAmount: 160,
    });
    expect(result.equation.status).toBe('INCOMPLETO');
  });

  it('agrupa cierres usando el año contable de America/Havana', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      approvedClosures: [
        {
          id: 'closure-local-2025',
          type: 'anual',
          state: 'aprobado',
          approvedBy: 'user-1',
          endedAt: '2026-01-01T04:30:00Z',
          gains: 100,
          losses: 20,
        },
        {
          id: 'closure-utc-2025',
          type: 'anual',
          state: 'aprobado',
          approvedBy: 'user-1',
          endedAt: '2025-12-31T05:30:00Z',
          gains: 90,
          losses: 10,
        },
      ],
    });

    expect(result.equity.retainedEarnings).toBe(0);
    expect(result.incidents).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ANNUAL_CLOSURE',
      itemId: '2025',
    }));
  });

  it('expone el fallback de inventario como estimación', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      inventory: [{
        id: 'product-1',
        quantity: 5,
        historicalLayers: [{ quantity: 2, unitCost: 10 }],
        fallbackUnitCost: 30,
      }],
    });

    expect(result.assets.inventory).toEqual({ historical: 20, estimated: 90, total: 110 });
    expect(result.estimates).toEqual([{
      code: 'CURRENT_INVENTORY_COST',
      itemId: 'product-1',
      affectedAmount: 90,
    }]);
  });

  it('consume primero las capas antiguas cuando el stock físico es menor al histórico', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      inventory: [{
        id: 'product-1',
        quantity: 2,
        historicalLayers: [
          { quantity: 3, unitCost: 10 },
          { quantity: 2, unitCost: 30 },
        ],
        fallbackUnitCost: 99,
      }],
    });

    expect(result.assets.inventory).toEqual({ historical: 60, estimated: 0, total: 60 });
  });

  it('devuelve DIFERENCIA sin forzar la ecuación a cero', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      bankBalances: [{ id: 'bank-1', amount: 100 }],
      capitalContributions: [{
        id: 'capital-1',
        amount: 80,
        registeredAt: '2026-01-01T00:00:00Z',
      }],
    });

    expect(result.equation).toEqual({
      assets: 100,
      liabilitiesAndEquity: 80,
      difference: 20,
      status: 'DIFERENCIA',
    });
  });

  it('prioriza INCOMPLETO cuando existen partidas sin cobertura', () => {
    const unresolvedParts = [{
      source: 'bank',
      itemId: 'usd-account',
      issue: 'MISSING_CONVERSION',
      affectedAmount: 100,
    }];
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      unresolvedParts,
    });

    expect(result.equation.status).toBe('INCOMPLETO');
    expect(result.coverage).toEqual({
      complete: false,
      unresolvedCount: 1,
      unresolvedAmount: 100,
      parts: unresolvedParts,
    });
  });

  it('aísla importes no finitos para que no contaminen la ecuación', () => {
    const result = calculateCurrentBalance({
      ...BASE_INPUT,
      receivables: [{ id: 'bad-ar', debt: Number.NaN, paid: 0, state: 'PENDIENTE' }],
      payables: [{
        id: 'bad-ap', pendingBalance: Number.NaN, state: 'PENDIENTE', deleted: false,
      }],
      externalDebts: [{ id: 'bad-debt', pendingBalance: Number.NaN, state: 'ACTIVA' }],
      capitalContributions: [{
        id: 'bad-capital', amount: Number.NaN, registeredAt: '2026-01-01T00:00:00Z',
      }],
      approvedClosures: [{
        id: 'bad-closure', type: 'anual', state: 'aprobado', approvedBy: 'user-1',
        endedAt: '2025-12-31T23:59:59Z', gains: Number.NaN, losses: 0,
      }],
      currentResult: Number.NaN,
    });

    expect(result.assets.total).toBe(0);
    expect(result.liabilities.total).toBe(0);
    expect(result.equity.total).toBe(0);
    expect(result.equation.difference).toBe(0);
    expect(result.incidents.filter((incident) => incident.code === 'INVALID_AMOUNT'))
      .toHaveLength(6);
    expect(result.equation.status).toBe('INCOMPLETO');
  });
});
