/**
 * @description Verifica que las páginas de contratos no salten el catálogo tenant-scoped del cliente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, formMock, getClientesMock, getVendorsMock, getContratoMock } = vi.hoisted(() => ({
  prismaMock: { contrato: { findMany: vi.fn() } },
  formMock: vi.fn(() => null),
  getClientesMock: vi.fn(),
  getVendorsMock: vi.fn(),
  getContratoMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/features/clientes', () => ({ getClientesAction: getClientesMock }))
vi.mock('@/features/vendors', () => ({ getVendorsAction: getVendorsMock }))
vi.mock('@/features/contratos', () => ({
  ContratoForm: formMock,
  getContratoByIdAction: getContratoMock,
}))
vi.mock('@/lib/server-actions/helpers', () => ({
  unwrapActionResponseWithDefault: (response: unknown) => response,
}))

import NewContratoPage from '../new/page'
import UpdateContratoPage from '../update/[id]/page'

describe('preload del selector de tipos personalizados de contratos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getClientesMock.mockResolvedValue({ success: true, data: [] })
    getVendorsMock.mockResolvedValue({ success: true, data: [] })
    getContratoMock.mockResolvedValue({
      success: true,
      data: {
        contratoId: 'contract-1',
        tipo: 'OTRO',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: null,
        monto: null,
        moneda: 'CUP',
        esMultiMoneda: false,
        cliente: null,
        vendor: null,
        numeroContratoClienteProveedor: null,
        observaciones: null,
        condiciones: null,
      },
    })
    prismaMock.contrato.findMany.mockResolvedValue([])
  })

  it.each([
    ['new page', () => NewContratoPage()],
    ['update page', () => UpdateContratoPage({ params: Promise.resolve({ id: 'contract-1' }) })],
  ])('%s leaves custom-type loading to the authenticated client endpoint', async (_label, renderPage) => {
    const page = await renderPage()
    const form = (page.props as { children: { props: Record<string, unknown> } }).children

    expect(prismaMock.contrato.findMany).not.toHaveBeenCalled()
    expect(form.props).not.toHaveProperty('initialTiposCustom')
  })
})
