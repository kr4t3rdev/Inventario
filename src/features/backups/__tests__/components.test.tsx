/**
 * @description UI component tests for backup dialogs and display components.
 * Pure render + interaction tests — no database required.
 *
 * @module features/backups/__tests__/components.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { BackupTriggerDialog } from '../components/backup-trigger-dialog'
import { BackupHistoryTable } from '../components/backup-history-table'
import { PlanList } from '../components/plan-list'
import { PlanFormDialog } from '../components/plan-form-dialog'
import { RestoreDialog } from '../components/restore-dialog'
import type { BackupLogRow } from '../hooks/use-backups'
import type { BackupPlanRow } from '../hooks/use-backup-plans'

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Test Data ──────────────────────────────────────────────

const FULL_LOG: BackupLogRow = {
  backupLogId: 'log-1',
  type: 'full',
  tenantId: null,
  status: 'completed',
  fileUrl: '/backups/full.sql.gz',
  fileName: 'full.sql.gz',
  fileSize: 1024 * 1024,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:05:00Z'),
  errorMessage: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

const RUNNING_LOG: BackupLogRow = { ...FULL_LOG, backupLogId: 'log-2', type: 'tenant', status: 'running', fileUrl: null, fileName: null, fileSize: null, completedAt: null }

const FAILED_LOG: BackupLogRow = { ...FULL_LOG, backupLogId: 'log-3', type: 'config', status: 'failed', errorMessage: 'timeout', fileUrl: null, fileName: null, fileSize: null, completedAt: null }

const ENABLED_PLAN: BackupPlanRow = {
  backupPlanId: 'plan-1', type: 'full', tenantId: null, schedule: '0 2 * * *', enabled: true, retention: 30,
  lastRunAt: new Date('2026-05-24T02:00:00Z'), nextRunAt: new Date('2026-05-25T02:00:00Z'),
  createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(),
}

const DISABLED_PLAN: BackupPlanRow = { ...ENABLED_PLAN, backupPlanId: 'plan-2', type: 'config', enabled: false, retention: 14, schedule: '0 2 * * 0', lastRunAt: null, nextRunAt: new Date('2026-05-31T02:00:00Z') }

// ─── BackupTriggerDialog ──────────────────────────────────

describe('BackupTriggerDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders trigger button', () => {
    render(<BackupTriggerDialog isCreating={false} error={null} onCreateBackup={vi.fn()}><button>Nueva copia</button></BackupTriggerDialog>)
    expect(screen.getByText('Nueva copia')).toBeDefined()
  })

  it('opens dialog on click', async () => {
    render(<BackupTriggerDialog isCreating={false} error={null} onCreateBackup={vi.fn()}><button>Nueva copia</button></BackupTriggerDialog>)
    await userEvent.click(screen.getByText('Nueva copia'))
    expect(screen.getByText('Nueva copia de seguridad')).toBeDefined()
  })

  it('calls onCreateBackup on submit', async () => {
    const fn = vi.fn()
    render(<BackupTriggerDialog isCreating={false} error={null} onCreateBackup={fn}><button>Nueva copia</button></BackupTriggerDialog>)
    await userEvent.click(screen.getByText('Nueva copia'))
    await userEvent.click(screen.getByText('Iniciar copia'))
    expect(fn).toHaveBeenCalledWith('full')
  })

  it('disables button while creating', async () => {
    render(<BackupTriggerDialog isCreating={true} error={null} onCreateBackup={vi.fn()}><button>Nueva copia</button></BackupTriggerDialog>)
    await userEvent.click(screen.getByText('Nueva copia'))
    expect(screen.getByText('Creando...')).toBeDefined()
  })

  it('shows error', async () => {
    render(<BackupTriggerDialog isCreating={false} error="Test error" onCreateBackup={vi.fn()}><button>Nueva copia</button></BackupTriggerDialog>)
    await userEvent.click(screen.getByText('Nueva copia'))
    expect(screen.getByText('Test error')).toBeDefined()
  })
})

// ─── PlanList ───────────────────────────────────────────────

describe('PlanList', () => {
  it('renders plans with labels', () => {
    render(<PlanList plans={[ENABLED_PLAN, DISABLED_PLAN]} isLoading={false} onToggle={vi.fn()} onDelete={vi.fn()} onCreateNew={vi.fn()} />)
    expect(screen.getByText('Completo')).toBeDefined()
    expect(screen.getByText('30 días')).toBeDefined()
    expect(screen.getByText('Diario (2 AM)')).toBeDefined()
  })

  it('shows correct toggle states', () => {
    render(<PlanList plans={[ENABLED_PLAN, DISABLED_PLAN]} isLoading={false} onToggle={vi.fn()} onDelete={vi.fn()} onCreateNew={vi.fn()} />)
    const toggles = screen.getAllByRole('switch')
    expect(toggles[0].getAttribute('aria-checked')).toBe('true')
    expect(toggles[1].getAttribute('aria-checked')).toBe('false')
  })

  it('calls onToggle', async () => {
    const fn = vi.fn().mockResolvedValue(true)
    render(<PlanList plans={[ENABLED_PLAN, DISABLED_PLAN]} isLoading={false} onToggle={fn} onDelete={vi.fn()} onCreateNew={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('switch')[1])
    expect(fn).toHaveBeenCalledWith({ planId: 'plan-2', enabled: true })
  })

  it('shows loading state', () => {
    const { container } = render(<PlanList plans={[]} isLoading={true} onToggle={vi.fn()} onDelete={vi.fn()} onCreateNew={vi.fn()} />)
    expect(container.querySelector('.animate-spin')).toBeDefined()
  })

  it('shows empty state', () => {
    render(<PlanList plans={[]} isLoading={false} onToggle={vi.fn()} onDelete={vi.fn()} onCreateNew={vi.fn()} />)
    expect(screen.getByText('No hay planes programados')).toBeDefined()
  })
})

// ─── BackupHistoryTable ─────────────────────────────────────

describe('BackupHistoryTable', () => {
  const base = { onDelete: vi.fn(), onDownload: vi.fn(), onRestore: vi.fn(), onRefresh: vi.fn(), typeFilter: '', statusFilter: '', onTypeFilterChange: vi.fn(), onStatusFilterChange: vi.fn() }

  it('renders logs', () => {
    render(<BackupHistoryTable logs={[FULL_LOG, RUNNING_LOG, FAILED_LOG]} isLoading={false} total={3} {...base} />)
    // Badges coexist with filter dropdown options — use getAllByText
    expect(screen.getAllByText('Completado').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('En progreso').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Fallido').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1.00 MB')).toBeDefined()
  })

  it('shows loading', () => {
    const { container } = render(<BackupHistoryTable logs={[]} isLoading={true} total={0} {...base} />)
    expect(container.querySelector('.animate-spin')).toBeDefined()
  })

  it('shows empty', () => {
    render(<BackupHistoryTable logs={[]} isLoading={false} total={0} {...base} />)
    expect(screen.getByText('No se encontraron copias de seguridad')).toBeDefined()
  })
})

// ─── PlanFormDialog ─────────────────────────────────────────

describe('PlanFormDialog', () => {
  it('renders form', () => {
    render(<PlanFormDialog open={true} onOpenChange={vi.fn()} isSaving={false} error={null} onSubmit={vi.fn()} />)
    expect(screen.getByText('Nuevo plan')).toBeDefined()
    expect(screen.getByText('Crear plan')).toBeDefined()
  })

  it('calls onSubmit', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    render(<PlanFormDialog open={true} onOpenChange={vi.fn()} isSaving={false} error={null} onSubmit={fn} />)
    await userEvent.click(screen.getByText('Crear plan'))
    expect(fn).toHaveBeenCalled()
  })

  it('shows error', () => {
    render(<PlanFormDialog open={true} onOpenChange={vi.fn()} isSaving={false} error="X" onSubmit={vi.fn()} />)
    expect(screen.getByText('X')).toBeDefined()
  })

  it('shows custom cron input', async () => {
    render(<PlanFormDialog open={true} onOpenChange={vi.fn()} isSaving={false} error={null} onSubmit={vi.fn()} />)
    await userEvent.selectOptions(screen.getByDisplayValue('Diario (2 AM)') as HTMLSelectElement, 'custom')
    expect(screen.getByPlaceholderText('0 2 * * *')).toBeDefined()
  })
})

// ─── RestoreDialog ──────────────────────────────────────────

describe('RestoreDialog', () => {
  it('shows warning step', () => {
    render(<RestoreDialog backup={FULL_LOG} open={true} onOpenChange={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByText(/ADVERTENCIA/)).toBeDefined()
    expect(screen.getByText('Entendido, continuar')).toBeDefined()
  })

  it('proceeds to typing step', async () => {
    render(<RestoreDialog backup={FULL_LOG} open={true} onOpenChange={vi.fn()} onRestore={vi.fn()} />)
    await userEvent.click(screen.getByText('Entendido, continuar'))
    expect(screen.getByPlaceholderText('FULL RESTORE')).toBeDefined()
  })
})
