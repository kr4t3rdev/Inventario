import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PeriodoDetail } from '../PeriodoDetail'

const mockUseGetPeriodoQuery = vi.fn()
const aprobarMock = vi.fn()
const reabrirMock = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetPeriodoQuery: (...args: unknown[]) => mockUseGetPeriodoQuery(...args),
  useAprobarPeriodoMutation: () => [aprobarMock, { isLoading: false }],
  useReabrirPeriodoMutation: () => [reabrirMock, { isLoading: false }],
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

describe('PeriodoDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra snapshot, inconsistencias, apertura, subperíodos y auditorías del contrato real', () => {
    mockUseGetPeriodoQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        periodoId: 'p-1',
        codigo: 'D-2026-04-25',
        tipo: 'DIARIO',
        estado: 'CERRADO',
        fechaInicio: '2026-04-25T00:00:00.000Z',
        fechaFin: '2026-04-25T23:59:59.999Z',
        puedeOperar: false,
        puedeCerrar: false,
        puedeAprobar: true,
        puedeReabrir: true,
        blockers: ['El período está cerrado/aprobado pero no tiene snapshot legacy.'],
        apertura: {
          aperturaId: 'ap-1',
          saldoCajaInicial: 100,
          saldoBancoInicial: 200,
          saldoCuentasCobrarInicial: 30,
          saldoCuentasPagarInicial: 40,
          saldoInventarioInicial: 500,
          saldoCapitalInicial: 1000,
          saldoResultadoAcumInicial: 60,
        },
        snapshots: [
          {
            snapshotId: 'snap-1',
            version: 1,
            resumenJson: {
              totalIngresos: 300,
              totalGastos: 80,
              diferencia: 220,
              saldoCajaFinal: 150,
            },
            inconsistenciasJson: ['Diferencia de caja detectada'],
            createdAt: '2026-04-25T23:00:00.000Z',
          },
        ],
        subperiodos: [
          { periodoId: 'sp-1', codigo: 'D-2026-04-24', estado: 'CERRADO' },
        ],
        auditorias: [
          {
            auditoriaId: 'aud-1',
            accion: 'CERRAR',
            usuarioId: 'user-1',
            motivo: 'Cierre operativo',
            createdAt: '2026-04-25T23:10:00.000Z',
          },
        ],
      },
    })

    render(<PeriodoDetail periodoId="p-1" onBack={vi.fn()} />)

    expect(screen.getAllByText('D-2026-04-25').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Snapshot Actual')).toBeInTheDocument()
    expect(screen.getByText('Total Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Diferencia de caja detectada')).toBeInTheDocument()
    expect(screen.getByText('Apertura')).toBeInTheDocument()
    expect(screen.getByText('Subperíodos')).toBeInTheDocument()
    expect(screen.getByText(/D-2026-04-24/)).toBeInTheDocument()
    expect(screen.getByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByText('Cierre operativo')).toBeInTheDocument()
  })
})
