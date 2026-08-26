import { vi } from 'vitest';

/**
 * Fábricas de pruebas reutilizables para el dominio de provisioning de
 * `TenantAccountingPolicy`. Los datos son sintéticos y no contienen información
 * contable sensible; los conteos representan únicamente cardinalidades seguras.
 */

export interface EvidenceSourceCounts {
  checkpoints?: number;
  snapshots?: number;
  sales?: number;
  services?: number;
  expenses?: number;
}

export interface AccountingPolicyPrismaMock {
  tenantAccountingPolicy: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  moneda: { findFirst: ReturnType<typeof vi.fn> };
  financialAuxiliaryCheckpoint: { count: ReturnType<typeof vi.fn> };
  snapshotPeriodo: { count: ReturnType<typeof vi.fn> };
  reconciliacionVenta: { count: ReturnType<typeof vi.fn> };
  reconciliacionServicio: { count: ReturnType<typeof vi.fn> };
  reconciliacionGasto: { count: ReturnType<typeof vi.fn> };
  accountingPolicyTenantApproval: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  tenantLicense: { count: ReturnType<typeof vi.fn> };
  $executeRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
}

/**
 * @description Construye un cliente mínimo con las cinco fuentes canónicas de
 *              evidencia contable para caracterizar clasificación y provisioning.
 * @param {EvidenceSourceCounts} counts - Cardinalidades por fuente canónica.
 * @returns {object} Cliente de prueba tenant-scoped.
 */
export function createEvidenceClientMock(counts: EvidenceSourceCounts = {}) {
  return {
    financialAuxiliaryCheckpoint: {
      count: vi.fn().mockResolvedValue(counts.checkpoints ?? 0),
    },
    snapshotPeriodo: {
      count: vi.fn().mockResolvedValue(counts.snapshots ?? 0),
    },
    reconciliacionVenta: {
      count: vi.fn().mockResolvedValue(counts.sales ?? 0),
    },
    reconciliacionServicio: {
      count: vi.fn().mockResolvedValue(counts.services ?? 0),
    },
    reconciliacionGasto: {
      count: vi.fn().mockResolvedValue(counts.expenses ?? 0),
    },
  };
}

/**
 * @description Construye el mock Prisma completo usado por el orquestador de
 *              políticas: fuentes de evidencia más política, moneda activa,
 *              aprobaciones tenant, auditoría y primitivas transaccionales.
 * @param {EvidenceSourceCounts} counts - Cardinalidades iniciales de evidencia.
 * @param {string} activeCurrency - Código de la moneda activa devuelta por defecto.
 * @returns {AccountingPolicyPrismaMock} Mock Prisma listo para usar en pruebas.
 */
export function createAccountingPolicyPrismaMock(
  counts: EvidenceSourceCounts = {},
  activeCurrency = 'USD',
): AccountingPolicyPrismaMock {
  const evidence = createEvidenceClientMock(counts);
  return {
    tenantAccountingPolicy: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    moneda: { findFirst: vi.fn().mockResolvedValue({ codigo: activeCurrency }) },
    financialAuxiliaryCheckpoint: evidence.financialAuxiliaryCheckpoint,
    snapshotPeriodo: evidence.snapshotPeriodo,
    reconciliacionVenta: evidence.reconciliacionVenta,
    reconciliacionServicio: evidence.reconciliacionServicio,
    reconciliacionGasto: evidence.reconciliacionGasto,
    accountingPolicyTenantApproval: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    tenantLicense: { count: vi.fn().mockResolvedValue(0) },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
}
