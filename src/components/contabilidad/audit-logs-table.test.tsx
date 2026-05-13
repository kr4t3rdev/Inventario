/**
 * @description Pruebas para la tabla de logs de auditoría
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { AuditLogsTable } from './audit-logs-table'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

const mockLogsResponse = {
  logs: [
    {
      id: 'log-1',
      entidad: 'TRANSFERENCIA',
      entidadId: 'trf-1',
      accion: 'CREATE',
      usuarioId: 'user-abc-123',
      detalles: { monto: 1000, moneda: 'CUP' },
      createdAt: '2025-06-15T10:30:00.000Z',
    },
    {
      id: 'log-2',
      entidad: 'TIPO_PAGO',
      entidadId: 'tp-1',
      accion: 'UPDATE',
      usuarioId: 'user-def-456',
      detalles: { nombre: 'Efectivo' },
      createdAt: '2025-06-14T08:00:00.000Z',
    },
  ],
  total: 2,
}

describe('AuditLogsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe mostrar los logs de auditoría', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockLogsResponse,
    })

    render(<AuditLogsTable />)

    await waitFor(() => {
      expect(screen.getByText('Registro de Auditoría')).toBeInTheDocument()
      expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument()
      expect(screen.getByText('TIPO_PAGO')).toBeInTheDocument()
    })
  })

  it('debe mostrar el total de eventos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockLogsResponse,
    })

    render(<AuditLogsTable />)

    await waitFor(() => {
      expect(screen.getByText(/Total: 2 eventos/)).toBeInTheDocument()
    })
  })

  it('debe mostrar loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<AuditLogsTable />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('debe mostrar error state cuando falla la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Error interno' }),
    })

    render(<AuditLogsTable />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar auditoría')).toBeInTheDocument()
    })
  })

  it('debe mostrar mensaje de permisos cuando es 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Prohibido' }),
    })

    render(<AuditLogsTable />)

    await waitFor(() => {
      expect(screen.getByText(/No tienes permisos de administrador/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('debe mostrar vacío cuando no hay logs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ logs: [], total: 0 }),
    })

    render(<AuditLogsTable />)

    await waitFor(() => {
      expect(screen.getByText('Sin registros de auditoría')).toBeInTheDocument()
    })
  })
})
