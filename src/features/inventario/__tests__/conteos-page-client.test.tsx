import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/features/inventario/actions-conteos', () => ({
  iniciarConteoAction: vi.fn(),
  registrarConteoAction: vi.fn(),
  conciliarConteoAction: vi.fn(),
  cancelarConteoAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import {
  cancelarConteoAction,
  conciliarConteoAction,
  iniciarConteoAction,
  registrarConteoAction,
} from '@/features/inventario/actions-conteos'
import { ConteosPageClient } from '@/features/inventario/components/conteos-page-client'

const almacenes = [{ almacenId: 'alm-1', nombre: 'Principal' }] as any[]

function renderPage(conteos: any[] = []) {
  return render(
    <ConteosPageClient almacenes={almacenes} puntosVenta={[]} conteosIniciales={conteos} />,
  )
}

describe('ConteosPageClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inicia un conteo en la ubicación seleccionada', async () => {
    vi.mocked(iniciarConteoAction).mockResolvedValue({
      success: true,
      data: { id: 'c-1', estado: 'BORRADOR' },
    } as any)

    renderPage()
    fireEvent.change(screen.getByLabelText(/tipo de ubicación/i), {
      target: { value: 'almacen' },
    })
    fireEvent.change(screen.getByLabelText(/^ubicación$/i), {
      target: { value: 'alm-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /iniciar conteo/i }))

    await waitFor(() => {
      expect(iniciarConteoAction).toHaveBeenCalledWith(
        expect.objectContaining({ tipoUbicacion: 'almacen', ubicacionId: 'alm-1' }),
      )
    })
  })

  it('registra capturas con el usuario actual y llama registrarConteo', async () => {
    vi.mocked(registrarConteoAction).mockResolvedValue({ success: true } as any)

    renderPage([
      {
        id: 'c-1',
        tenantId: 'tenant-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        estado: 'BORRADOR',
        createdAt: new Date().toISOString(),
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))
    fireEvent.change(screen.getAllByLabelText(/cantidad/i)[0], { target: { value: '9' } })
    fireEvent.change(screen.getAllByLabelText(/producto/i)[0], { target: { value: 'prod-1' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar captura/i }))

    await waitFor(() => {
      expect(registrarConteoAction).toHaveBeenCalledWith(
        expect.objectContaining({
          conteoId: 'c-1',
          lineas: [{ productoId: 'prod-1', cantidad: 9 }],
        }),
      )
    })
  })

  it('concilia un conteo en CONTEO_2', async () => {
    vi.mocked(conciliarConteoAction).mockResolvedValue({
      success: true,
      data: { ajustes: 1, estado: 'AJUSTADO' },
    } as any)

    renderPage([
      {
        id: 'c-1',
        tenantId: 'tenant-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        estado: 'CONTEO_2',
        createdAt: new Date().toISOString(),
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /conciliar/i }))

    await waitFor(() => {
      expect(conciliarConteoAction).toHaveBeenCalledWith(
        expect.objectContaining({ conteoId: 'c-1' }),
      )
    })
  })

  it('cancela un conteo', async () => {
    vi.mocked(cancelarConteoAction).mockResolvedValue({ success: true } as any)

    renderPage([
      {
        id: 'c-1',
        tenantId: 'tenant-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        estado: 'BORRADOR',
        createdAt: new Date().toISOString(),
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    await waitFor(() => {
      expect(cancelarConteoAction).toHaveBeenCalledWith({ conteoId: 'c-1' })
    })
  })
})
