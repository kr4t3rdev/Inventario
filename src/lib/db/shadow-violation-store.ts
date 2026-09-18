import type { ViolationReport } from '@/lib/db/scoped-prisma';

const STORE_CAPACITY = 500;

export interface StoredViolationReport extends ViolationReport {
  recordedAt: string;
}

export interface ShadowViolationSnapshot {
  startedAt: string;
  totalCaptured: number;
  dropped: number;
  capacity: number;
  reports: StoredViolationReport[];
}

interface ShadowViolationState {
  startedAt: string;
  totalCaptured: number;
  dropped: number;
  reports: StoredViolationReport[];
}

const state: ShadowViolationState = {
  startedAt: new Date().toISOString(),
  totalCaptured: 0,
  dropped: 0,
  reports: [],
};

/**
 * @description Registra una violación shadow en el buffer acotado de la instancia.
 * @param {ViolationReport} report - Violación estructurada sin datos sensibles.
 * @returns {void}
 */
export function recordShadowViolation(report: ViolationReport): void {
  state.totalCaptured += 1;
  state.reports.push({ ...report, recordedAt: new Date().toISOString() });

  if (state.reports.length > STORE_CAPACITY) {
    state.reports.splice(0, state.reports.length - STORE_CAPACITY);
    state.dropped += 1;
  }
}

/**
 * @description Obtiene una copia del estado local de telemetría shadow.
 * @returns {ShadowViolationSnapshot} Snapshot inmutable para consumidores.
 */
export function getShadowViolationSnapshot(): ShadowViolationSnapshot {
  return {
    startedAt: state.startedAt,
    totalCaptured: state.totalCaptured,
    dropped: state.dropped,
    capacity: STORE_CAPACITY,
    reports: state.reports.map((report) => ({ ...report })),
  };
}

/**
 * @description Reinicia el buffer local; reservado para aislamiento de tests.
 * @returns {void}
 */
export function resetShadowViolationStore(): void {
  state.startedAt = new Date().toISOString();
  state.totalCaptured = 0;
  state.dropped = 0;
  state.reports.length = 0;
}
