export const ACTIVE_RECEIVABLE_STATES = ['PENDIENTE', 'PARCIAL'] as const;
export const ACTIVE_PAYABLE_STATES = ['PENDIENTE', 'PARCIAL'] as const;
export const ACTIVE_EXTERNAL_DEBT_STATES = ['ACTIVA', 'EN_MORA'] as const;

export type ReceivableState = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';
export type PayableState = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
export type ExternalDebtState = 'ACTIVA' | 'EN_MORA' | 'PAGADA';
export type BalanceEquationStatus = 'CUADRADO' | 'DIFERENCIA' | 'INCOMPLETO';

export interface BalanceUnresolvedPart {
  source: string;
  itemId: string;
  issue: string;
  affectedAmount: number;
}

export interface CalculateCurrentBalanceInput {
  asOf: Date | string;
  functionalCurrency: string;
  bankBalances: Array<{ id: string; amount: number }>;
  inventory: Array<{
    id: string;
    quantity: number;
    historicalLayers: Array<{ quantity: number; unitCost: number }>;
    fallbackUnitCost: number;
  }>;
  receivables: Array<{
    id: string;
    debt: number;
    paid: number;
    state: ReceivableState;
  }>;
  payables: Array<{
    id: string;
    pendingBalance: number;
    state: PayableState;
    deleted: boolean;
  }>;
  externalDebts: Array<{
    id: string;
    pendingBalance: number;
    state: ExternalDebtState;
  }>;
  capitalContributions: Array<{
    id: string;
    amount: number;
    registeredAt: Date | string;
  }>;
  approvedClosures: Array<{
    id: string;
    type: string;
    state: string;
    approvedBy: string | null;
    endedAt: Date | string;
    gains: number;
    losses: number;
  }>;
  currentResult: number;
  unresolvedParts: BalanceUnresolvedPart[];
}

export interface BalanceIncident {
  code:
    | 'INVALID_AMOUNT'
    | 'INVALID_DATE'
    | 'DUPLICATE_ANNUAL_CLOSURE'
    | 'NEGATIVE_RECEIVABLE_BALANCE'
    | 'NEGATIVE_PAYABLE_BALANCE'
    | 'NEGATIVE_INVENTORY_QUANTITY';
  itemId: string;
  affectedAmount: number;
}

export interface CurrentBalanceResult {
  asOf: string;
  functionalCurrency: string;
  assets: {
    cashAndBanks: number;
    inventory: { historical: number; estimated: number; total: number };
    receivables: number;
    total: number;
  };
  liabilities: { payables: number; externalDebt: number; total: number };
  equity: {
    capital: number;
    retainedEarnings: number;
    currentResult: number;
    total: number;
  };
  equation: {
    assets: number;
    liabilitiesAndEquity: number;
    difference: number;
    status: BalanceEquationStatus;
  };
  coverage: {
    complete: boolean;
    unresolvedCount: number;
    unresolvedAmount: number;
    parts: BalanceUnresolvedPart[];
  };
  estimates: Array<{
    code: 'CURRENT_INVENTORY_COST';
    itemId: string;
    affectedAmount: number;
  }>;
  incidents: BalanceIncident[];
}

/**
 * @description Indica si un estado pertenece al conjunto de estados activos.
 * @param {string} state - Estado que se evaluará.
 * @param {readonly string[]} activeStates - Estados que conservan saldo pendiente.
 * @returns {boolean} Verdadero cuando el estado debe formar parte del balance.
 */
function isActiveState(state: string, activeStates: readonly string[]): boolean {
  return activeStates.includes(state);
}

/**
 * @description Suma importes finitos y positivos, registrando datos inválidos.
 * @param {Array<{id: string, amount: number}>} amounts - Importes que se acumularán.
 * @param {BalanceIncident[]} incidents - Colección mutable de incidencias.
 * @returns {number} Total válido acumulado.
 */
function sumValidAmounts(
  amounts: Array<{ id: string; amount: number }>,
  incidents: BalanceIncident[],
): number {
  return amounts.reduce((total, item) => {
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: item.id, affectedAmount: 0 });
      return total;
    }
    return total + item.amount;
  }, 0);
}

/**
 * @description Construye un balance actual sin ocultar diferencias ni partidas sin cobertura.
 * @param {CalculateCurrentBalanceInput} input - Partidas normalizadas y fecha de corte.
 * @returns {CurrentBalanceResult} Balance explicable con ecuación, cobertura e incidencias.
 */
export function calculateCurrentBalance(
  input: CalculateCurrentBalanceInput,
): CurrentBalanceResult {
  const incidents: BalanceIncident[] = [];
  const estimates: CurrentBalanceResult['estimates'] = [];
  const asOf = new Date(input.asOf);
  const asOfTime = asOf.getTime();
  const cashAndBanks = sumValidAmounts(input.bankBalances, incidents);

  let inventoryHistorical = 0;
  let inventoryEstimated = 0;
  for (const item of input.inventory) {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      incidents.push({
        code: 'NEGATIVE_INVENTORY_QUANTITY',
        itemId: item.id,
        affectedAmount: Number.isFinite(item.quantity) ? Math.abs(item.quantity) : 0,
      });
      continue;
    }
    let remainingQuantity = item.quantity;
    const validLayers: Array<{ quantity: number; unitCost: number }> = [];
    for (const layer of item.historicalLayers) {
      if (
        !Number.isFinite(layer.quantity) ||
        !Number.isFinite(layer.unitCost) ||
        layer.quantity <= 0 ||
        layer.unitCost < 0
      ) {
        incidents.push({ code: 'INVALID_AMOUNT', itemId: item.id, affectedAmount: 0 });
        continue;
      }
      validLayers.push(layer);
    }
    let quantityToDiscard = Math.max(
      0,
      validLayers.reduce((total, layer) => total + layer.quantity, 0) - item.quantity,
    );
    for (const layer of validLayers) {
      if (remainingQuantity <= 0) break;
      const discardedQuantity = Math.min(quantityToDiscard, layer.quantity);
      quantityToDiscard -= discardedQuantity;
      const layerRemaining = layer.quantity - discardedQuantity;
      const usedQuantity = Math.min(remainingQuantity, layerRemaining);
      inventoryHistorical += usedQuantity * layer.unitCost;
      remainingQuantity -= usedQuantity;
    }
    if (remainingQuantity > 0) {
      const estimatedAmount = Number.isFinite(item.fallbackUnitCost) && item.fallbackUnitCost >= 0
        ? remainingQuantity * item.fallbackUnitCost
        : 0;
      inventoryEstimated += estimatedAmount;
      estimates.push({
        code: 'CURRENT_INVENTORY_COST',
        itemId: item.id,
        affectedAmount: estimatedAmount,
      });
    }
  }

  let receivables = 0;
  for (const account of input.receivables) {
    if (!isActiveState(account.state, ACTIVE_RECEIVABLE_STATES)) continue;
    if (!Number.isFinite(account.debt) || !Number.isFinite(account.paid)) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: account.id, affectedAmount: 0 });
      continue;
    }
    const balance = account.debt - account.paid;
    if (balance < 0) {
      incidents.push({
        code: 'NEGATIVE_RECEIVABLE_BALANCE',
        itemId: account.id,
        affectedAmount: Math.abs(balance),
      });
    }
    receivables += Math.max(0, balance);
  }

  let payables = 0;
  for (const account of input.payables) {
    if (account.deleted || !isActiveState(account.state, ACTIVE_PAYABLE_STATES)) continue;
    if (!Number.isFinite(account.pendingBalance)) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: account.id, affectedAmount: 0 });
      continue;
    }
    if (account.pendingBalance < 0) {
      incidents.push({
        code: 'NEGATIVE_PAYABLE_BALANCE',
        itemId: account.id,
        affectedAmount: Math.abs(account.pendingBalance),
      });
    }
    payables += Math.max(0, account.pendingBalance);
  }

  const externalDebt = input.externalDebts.reduce((total, debt) => {
    if (!isActiveState(debt.state, ACTIVE_EXTERNAL_DEBT_STATES)) return total;
    if (!Number.isFinite(debt.pendingBalance)) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: debt.id, affectedAmount: 0 });
      return total;
    }
    return total + Math.max(0, debt.pendingBalance);
  }, 0);

  const capital = input.capitalContributions.reduce((total, contribution) => {
    const registeredAt = new Date(contribution.registeredAt).getTime();
    if (Number.isNaN(registeredAt)) {
      incidents.push({ code: 'INVALID_DATE', itemId: contribution.id, affectedAmount: 0 });
      return total;
    }
    if (!Number.isFinite(contribution.amount)) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: contribution.id, affectedAmount: 0 });
      return total;
    }
    return registeredAt <= asOfTime ? total + contribution.amount : total;
  }, 0);

  const closuresByYear = new Map<number, typeof input.approvedClosures>();
  for (const closure of input.approvedClosures) {
    const endedAt = new Date(closure.endedAt).getTime();
    const isApprovedAnnual = closure.type.toUpperCase() === 'ANUAL' &&
      closure.state.toUpperCase() === 'APROBADO' && Boolean(closure.approvedBy);
    if (!isApprovedAnnual || endedAt > asOfTime) continue;
    if (Number.isNaN(endedAt)) {
      incidents.push({ code: 'INVALID_DATE', itemId: closure.id, affectedAmount: 0 });
      continue;
    }
    const year = new Date(endedAt).getUTCFullYear();
    const closures = closuresByYear.get(year) ?? [];
    closures.push(closure);
    closuresByYear.set(year, closures);
  }
  let retainedEarnings = 0;
  for (const [year, closures] of closuresByYear) {
    if (closures.length > 1) {
      const affectedAmount = closures.reduce((total, closure) => {
        const net = Number.isFinite(closure.gains) && Number.isFinite(closure.losses)
          ? closure.gains - closure.losses
          : 0;
        return total + Math.abs(net);
      }, 0);
      incidents.push({
        code: 'DUPLICATE_ANNUAL_CLOSURE',
        itemId: String(year),
        affectedAmount,
      });
      continue;
    }
    const closure = closures[0];
    if (!Number.isFinite(closure.gains) || !Number.isFinite(closure.losses)) {
      incidents.push({ code: 'INVALID_AMOUNT', itemId: closure.id, affectedAmount: 0 });
      continue;
    }
    retainedEarnings += closure.gains - closure.losses;
  }

  const inventoryTotal = inventoryHistorical + inventoryEstimated;
  const assetsTotal = cashAndBanks + inventoryTotal + receivables;
  const liabilitiesTotal = payables + externalDebt;
  const currentResult = Number.isFinite(input.currentResult) ? input.currentResult : 0;
  if (!Number.isFinite(input.currentResult)) {
    incidents.push({ code: 'INVALID_AMOUNT', itemId: 'current-period', affectedAmount: 0 });
  }
  const equityTotal = capital + retainedEarnings + currentResult;
  const liabilitiesAndEquity = liabilitiesTotal + equityTotal;
  const difference = assetsTotal - liabilitiesAndEquity;
  const coverage = {
    complete: input.unresolvedParts.length === 0 && incidents.length === 0,
    unresolvedCount: input.unresolvedParts.length,
    unresolvedAmount: input.unresolvedParts.reduce(
      (total, part) => total + Math.max(0, part.affectedAmount),
      0,
    ),
    parts: input.unresolvedParts,
  };
  const equationStatus: BalanceEquationStatus = !coverage.complete
    ? 'INCOMPLETO'
    : Math.abs(difference) <= 0.01
      ? 'CUADRADO'
      : 'DIFERENCIA';

  return {
    asOf: asOf.toISOString(),
    functionalCurrency: input.functionalCurrency,
    assets: {
      cashAndBanks,
      inventory: {
        historical: inventoryHistorical,
        estimated: inventoryEstimated,
        total: inventoryTotal,
      },
      receivables,
      total: assetsTotal,
    },
    liabilities: { payables, externalDebt, total: liabilitiesTotal },
    equity: {
      capital,
      retainedEarnings,
      currentResult,
      total: equityTotal,
    },
    equation: {
      assets: assetsTotal,
      liabilitiesAndEquity,
      difference,
      status: equationStatus,
    },
    coverage,
    estimates,
    incidents,
  };
}
