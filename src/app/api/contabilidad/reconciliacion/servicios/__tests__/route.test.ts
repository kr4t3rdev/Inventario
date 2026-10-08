import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { serviceMock, user, findMany, count, validatePeriod } = vi.hoisted(() => ({
  serviceMock: vi.fn(),
  user: {
    userId: 'user-a',
    tenantId: 'tenant-a',
    role: 'regularUser',
    tenantRole: 'economico',
    permissions: new Set(['financiero.contabilidad.acceder']),
    planFeatures: { servicios: true },
  },
  findMany: vi.fn(),
  count: vi.fn(),
  validatePeriod: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { ventaServicios: { findMany, count } },
  prisma: { ventaServicios: { findMany, count } },
}))
vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({ user })),
}))
vi.mock('@/lib/services/tenant-scope', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/tenant-scope')>(
    '@/lib/services/tenant-scope',
  )
  return { ...actual, requireFeature: vi.fn() }
})
vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: validatePeriod,
  extraerFechaDeBody: vi.fn((body: Record<string, unknown>) => body.fechaReconciliacion ?? null),
}))
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: { reconcileService: serviceMock },
}))

import { ActionError } from '@/lib/server-actions'
import { requireFeature } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write'
import { GET, POST } from '../route'

/** @description Crea una petición web con una distribución individual. */
function requestPago(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ventaServicioId: 'service-sale-a',
      cuentaId: 'account-a',
      tipoPagoId: 'payment-type-a',
      monto: 40,
      moneda: 'USD',
      tasaCambio: 25,
      tasaEfectivaEn: '2026-10-03T12:00:00.000Z',
      fechaReconciliacion: '2026-10-03T12:00:00.000Z',
      ...overrides,
    }),
  })
}

describe('Reconciliación de servicios web', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validatePeriod.mockResolvedValue({ permitido: true })
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
    serviceMock.mockResolvedValue({
      reconciliado: false,
      distribuciones: 1,
      reconciliaciones: [{ reconciliacionId: 'reconciliation-a' }],
    })
  })

  it('GET limita servicios y reconciliaciones al tenant autenticado', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios'),
    )

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        servicio: { is: { tenantId: 'tenant-a' } },
      }),
      include: expect.objectContaining({
        reconciliaciones: { where: { tenantId: 'tenant-a' }, select: { montoConvertido: true } },
      }),
    }))
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId: 'tenant-a' }) })
  })

  it('delega el cobro al workflow compartido y conserva la respuesta web', async () => {
    const response = await POST(requestPago())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(requireFeature).toHaveBeenCalledWith(user, 'servicios', 'reconciliar servicios')
    expect(validarEscrituraPeriodo).toHaveBeenCalled()
    expect(serviceMock).toHaveBeenCalledWith({
      user,
      input: {
        ventaServicioId: 'service-sale-a',
        fechaReconciliacion: '2026-10-03T12:00:00.000Z',
        distribuciones: [{
          cuentaId: 'account-a',
          tipoPagoId: 'payment-type-a',
          monto: 40,
          moneda: 'USD',
          tasaCambio: 25,
          fechaTasa: '2026-10-03T12:00:00.000Z',
          observaciones: undefined,
        }],
      },
    })
    expect(body).toMatchObject({
      reconciliado: false,
      distribuciones: 1,
      message: 'Servicio reconciliado exitosamente',
      reconciliacion: { reconciliacionId: 'reconciliation-a' },
    })
  })

  it('deniega el POST sin permiso antes de delegar', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValueOnce({
      user: { ...user, permissions: new Set<string>() },
    } as never)

    const response = await POST(requestPago())

    expect(response.status).toBe(403)
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('mapea una referencia de otro tenant como 404 sin mutaciones de ruta', async () => {
    serviceMock.mockRejectedValueOnce(new ActionError('Servicio no encontrado', 'NOT_FOUND'))

    const response = await POST(requestPago())

    expect(response.status).toBe(404)
    expect(serviceMock).toHaveBeenCalledTimes(1)
  })

  it('rechaza FX sin evidencia con 400', async () => {
    serviceMock.mockRejectedValueOnce(
      new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE'),
    )

    const response = await POST(requestPago())

    expect(response.status).toBe(400)
    expect(serviceMock).toHaveBeenCalledTimes(1)
  })

  it('no delega cuando el período contable está cerrado', async () => {
    validatePeriod.mockResolvedValueOnce({
      permitido: false,
      error: { message: 'Período cerrado', code: 'PERIODO_CERRADO' },
    })

    const response = await POST(requestPago())

    expect(response.status).toBe(400)
    expect(serviceMock).not.toHaveBeenCalled()
  })
})
