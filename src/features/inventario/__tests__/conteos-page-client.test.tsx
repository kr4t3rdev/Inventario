import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/features/inventario/actions-conteos', () => ({
  iniciarConteoAction: vi.fn(),
  registrarConteoAction: vi.fn(),
  conciliarConteoAction: vi.fn(),
  cancelarConteoAction: vi.fn(),
  getConteoLineasAction: vi.fn(),
}))

vi.mock('@/features/inventario/actions-ubicaciones', () => ({
  getUbicacionesHijasAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import {
  cancelarConteoAction,
  conciliarConteoAction,
  getConteoLineasAction,
  iniciarConteoAction,
  registrarConteoAction,
} from '@/features/inventario/actions-conteos'
import { ConteosPageClient } from '@/features/inventario/components/conteos-page-client'
import { getUbicacionesHijasAction } from '@/features/inventario/actions-ubicaciones'

const almacenes = [{ almacenId: 'alm-1', nombre: 'Principal' }] as any[]

function renderPage(conteos: any[] = [], ubicacionesAvanzadasHabilitadas = false) {
  return render(
    <ConteosPageClient
      almacenes={almacenes}
      puntosVenta={[]}
      conteosIniciales={conteos}
      ubicacionesAvanzadasHabilitadas={ubicacionesAvanzadasHabilitadas}
    />,
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

  it('carga hojas y crea conteo limitado a la ubicación hija seleccionada', async () => {
    vi.mocked(getUbicacionesHijasAction).mockResolvedValue({
      success: true,
      data: [{ id: 'hoja-a1', nombre: 'A-1', parentId: 'pasillo-a' }],
    } as never)
    vi.mocked(iniciarConteoAction).mockResolvedValue({ success: true } as never)

    renderPage([], true)
    fireEvent.change(screen.getByLabelText(/^ubicación$/i), { target: { value: 'alm-1' } })
    await waitFor(() => expect(getUbicacionesHijasAction).toHaveBeenCalledWith({ almacenId: 'alm-1' }))
    fireEvent.change(await screen.findByLabelText('Ubicación hija'), { target: { value: 'hoja-a1' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar conteo/i }))

    await waitFor(() => {
      expect(iniciarConteoAction).toHaveBeenCalledWith({
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        ubicacionHijaId: 'hoja-a1',
      })
    })
  })

  it('registra capturas con el usuario actual y llama registrarConteo', async () => {
    vi.mocked(registrarConteoAction).mockResolvedValue({ success: true } as any)
    vi.mocked(getConteoLineasAction).mockResolvedValue({
      success: true,
      data: {
        lineas: [
          { productoId: 'prod-1', nombre: 'Producto 1', codigoInterno: 'P-1', codigoNegocio: null },
          { productoId: 'prod-2', nombre: 'Producto 2', codigoInterno: 'P-2', codigoNegocio: null },
        ],
      },
    } as any)

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
    await screen.findByText('Producto 1')
    fireEvent.change(screen.getAllByLabelText(/cantidad/i)[0], { target: { value: '9' } })
    fireEvent.change(screen.getAllByLabelText(/cantidad/i)[1], { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar captura/i }))

    await waitFor(() => {
      expect(registrarConteoAction).toHaveBeenCalledWith(
        expect.objectContaining({
          conteoId: 'c-1',
          lineas: [
            { productoId: 'prod-1', cantidad: 9 },
            { productoId: 'prod-2', cantidad: 0 },
          ],
        }),
      )
    })
  })

  it('concilia un conteo en CONTEO_2', async () => {
    vi.mocked(conciliarConteoAction).mockResolvedValue({
      success: true,
      data: { ajustes: 1, estado: 'AJUSTADO' },
    } as any)
    vi.mocked(getConteoLineasAction).mockResolvedValue({
      success: true,
      data: {
        lineas: [
          {
            productoId: 'prod-1',
            nombre: 'Producto 1',
            codigoInterno: 'P-1',
            codigoNegocio: null,
            conteo1: 9,
            conteo2: 8,
          },
        ],
      },
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
    await screen.findByText(/pasada 1: 9 · pasada 2: 8/i)
    fireEvent.change(screen.getByLabelText(/cantidad final de producto 1/i), {
      target: { value: '8' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirmar conciliación/i }))

    await waitFor(() => {
      expect(conciliarConteoAction).toHaveBeenCalledWith(
        expect.objectContaining({
          conteoId: 'c-1',
          finales: [{ productoId: 'prod-1', contadoFinal: 8 }],
        }),
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
