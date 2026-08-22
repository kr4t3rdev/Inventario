import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock } = vi.hoisted(() => {
  const gastosDE = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  }
  const gastoConcepto = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  }
  const plan = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  const affiliateReferral = {
    findMany: vi.fn(),
    count: vi.fn(),
  }
  return {
    prismaMock: { gastosDE, gastoConcepto, plan, affiliateReferral },
  }
})

let currentRole = 'admin'

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma')
  return { ...actual, default: prismaMock, prisma: prismaMock }
})

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({ user: { userId: 'user-test', tenantId: 'tenant-1', role: currentRole } })),
}))

import { GET as getPlans, POST as createPlan } from '../plans/route'
import { GET as getPlanById, PUT as updatePlan, DELETE as deletePlan } from '../plans/[id]/route'
import { GET as getReferrals, POST as createReferral } from '../referrals/route'
import { GET as getReferralStats } from '../referrals/stats/route'
import { GET as getExpenses, POST as createExpense } from '../expenses/route'
import { GET as getExpenseById, DELETE as deleteExpense } from '../expenses/[id]/route'
import { GET as getConcepts, POST as createConcept } from '../expense-concepts/route'
import { GET as getConceptById, PUT as updateConcept, DELETE as deleteConcept } from '../expense-concepts/[id]/route'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('Mobile API: plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'admin'
  })

  it('GET /api/mobile/plans mapea Plan del schema a la forma móvil', async () => {
    ;(prismaMock.plan.findMany as Mock).mockResolvedValue([
      {
        planId: 'p1',
        nombre: 'Básico',
        descripcion: null,
        precio: '10.00',
        duracionDias: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 100,
        features: { ventas: true, contabilidad: false },
        incluyeBackups: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
    ])

    const response = await getPlans(new NextRequest('http://localhost/api/mobile/plans'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toEqual({
      planId: 'p1',
      nombre: 'Básico',
      descripcion: undefined,
      precio: 10,
      moneda: 'USD',
      usuariosMax: 3,
      almacenMax: 2,
      productosMax: 100,
      features: ['ventas'],
      estado: 'ACTIVO',
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date('2025-01-02').toISOString(),
    })
  })

  it('POST /api/mobile/plans crea un plan con datos del schema', async () => {
    ;(prismaMock.plan.create as Mock).mockResolvedValue({
      planId: 'p2',
      nombre: 'Nuevo',
      descripcion: null,
      precio: '5.00',
      maxUsuarios: 4,
      maxAlmacenes: 1,
      maxProductos: 50,
      features: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new NextRequest('http://localhost/api/mobile/plans', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Nuevo', precio: 5, usuariosMax: 4 }),
    })
    const response = await createPlan(request)

    expect(response.status).toBe(201)
    expect(prismaMock.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Nuevo',
          maxUsuarios: 4,
        }),
      }),
    )
  })

  it('POST /api/mobile/plans rechaza a no-admin con 403', async () => {
    currentRole = 'dependiente'
    const request = new NextRequest('http://localhost/api/mobile/plans', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'X', precio: 1, usuariosMax: 1 }),
    })
    const response = await createPlan(request)
    expect(response.status).toBe(403)
    expect(prismaMock.plan.create).not.toHaveBeenCalled()
  })

  it('PUT /api/mobile/plans/:id actualiza precio y límites', async () => {
    ;(prismaMock.plan.findUnique as Mock).mockResolvedValue({ planId: 'p1', nombre: 'Básico' })
    ;(prismaMock.plan.update as Mock).mockResolvedValue({
      planId: 'p1',
      nombre: 'Básico',
      descripcion: null,
      precio: '12.00',
      maxUsuarios: 5,
      maxAlmacenes: 2,
      maxProductos: 100,
      features: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new NextRequest('http://localhost/api/mobile/plans/p1', {
      method: 'PUT',
      body: JSON.stringify({ precio: 12, usuariosMax: 5 }),
    })
    const response = await updatePlan(request, ctx('p1'))

    expect(response.status).toBe(200)
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { planId: 'p1' },
        data: expect.objectContaining({ precio: 12, maxUsuarios: 5 }),
      }),
    )
  })

  it('DELETE /api/mobile/plans/:id elimina y devuelve success', async () => {
    ;(prismaMock.plan.delete as Mock).mockResolvedValue({ planId: 'p1' })
    const response = await deletePlan(new NextRequest('http://localhost/api/mobile/plans/p1'), ctx('p1'))
    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
  })
})

describe('Mobile API: referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'admin'
  })

  it('GET /api/mobile/referrals lista referidos del tenant con estados mapeados', async () => {
    ;(prismaMock.affiliateReferral.findMany as Mock).mockResolvedValue([
      { referralId: 'r1', referrerTenantId: 'tenant-1', referredTenantId: 't2', status: 'registered', createdAt: new Date(), confirmedAt: null, updatedAt: new Date() },
      { referralId: 'r2', referrerTenantId: 'tenant-1', referredTenantId: 't3', status: 'credited', createdAt: new Date(), confirmedAt: new Date(), updatedAt: new Date() },
    ])

    const response = await getReferrals(new NextRequest('http://localhost/api/mobile/referrals'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items[0]).toMatchObject({ referidoId: 'r1', clienteId: 't2', estado: 'PENDIENTE' })
    expect(data.items[1]).toMatchObject({ referidoId: 'r2', estado: 'COMPLETADO' })
    expect(prismaMock.affiliateReferral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referrerTenantId: 'tenant-1' } }),
    )
  })

  it('POST /api/mobile/referrals responde 501 (sin modelo de referidos de clientes)', async () => {
    const request = new NextRequest('http://localhost/api/mobile/referrals', {
      method: 'POST',
      body: JSON.stringify({ clienteId: 'c1' }),
    })
    const response = await createReferral(request)
    expect(response.status).toBe(501)
  })

  it('GET /api/mobile/referrals/stats devuelve total/activos/recompensas', async () => {
    ;(prismaMock.affiliateReferral.count as Mock)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3)

    const response = await getReferralStats(new NextRequest('http://localhost/api/mobile/referrals/stats'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ total: 10, activos: 6, recompensas: 3 })
  })
})

describe('Mobile API: expenses (GastosDE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'admin'
  })

  it('GET /api/mobile/expenses lista gastos del tenant con concepto incluido', async () => {
    ;(prismaMock.gastosDE.findMany as Mock).mockResolvedValue([
      {
        gastosDEId: 'g1',
        tenantId: 'tenant-1',
        conceptoId: 'c1',
        concepto: { nombre: 'Combustible' },
        proveedor: 'CN',
        monto: 1500,
        descripcion: 'Gasolina',
        numeroFactura: 'F-001',
        isPagado: 'PAGADO',
        createdAt: new Date('2025-08-01'),
        updatedAt: new Date('2025-08-01'),
      },
    ])

    const response = await getExpenses(new NextRequest('http://localhost/api/mobile/expenses'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items[0]).toMatchObject({
      gastoId: 'g1',
      conceptoId: 'c1',
      conceptoNombre: 'Combustible',
      monto: 1500,
      comprobante: 'F-001',
      estado: 'APROBADO',
    })
  })

  it('GET /api/mobile/expenses filtra por conceptoId', async () => {
    ;(prismaMock.gastosDE.findMany as Mock).mockResolvedValue([])
    await getExpenses(new NextRequest('http://localhost/api/mobile/expenses?conceptoId=c9'))
    expect(prismaMock.gastosDE.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ conceptoId: 'c9' }) }),
    )
  })

  it('POST /api/mobile/expenses crea GastoDE derivando periodo y proveedor', async () => {
    ;(prismaMock.gastosDE.create as Mock).mockResolvedValue({
      gastosDEId: 'g2',
      tenantId: 'tenant-1',
      conceptoId: 'c1',
      monto: 300,
      descripcion: 'Snacks',
      periodo: '2025-08',
      createdAt: new Date('2025-08-15T10:00:00Z'),
      updatedAt: new Date('2025-08-15T10:00:00Z'),
    })

    const request = new NextRequest('http://localhost/api/mobile/expenses', {
      method: 'POST',
      body: JSON.stringify({ conceptoId: 'c1', monto: 300, descripcion: 'Snacks', fecha: '2025-08-15T10:00:00Z' }),
    })
    const response = await createExpense(request)

    expect(response.status).toBe(201)
    expect(prismaMock.gastosDE.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          conceptoId: 'c1',
          monto: 300,
          periodo: '2025-08',
          descripcion: 'Snacks',
        }),
      }),
    )
  })

  it('DELETE /api/mobile/expenses/:id rechaza gasto de otro tenant con 404', async () => {
    ;(prismaMock.gastosDE.findUnique as Mock).mockResolvedValue(null)
    const response = await deleteExpense(new NextRequest('http://localhost/api/mobile/expenses/g1'), ctx('g1'))
    expect(response.status).toBe(404)
    expect(prismaMock.gastosDE.delete).not.toHaveBeenCalled()
  })
})

describe('Mobile API: expense-concepts (GastoConcepto)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'admin'
  })

  it('GET /api/mobile/expense-concepts lista conceptos activos/inactivos mapeados', async () => {
    ;(prismaMock.gastoConcepto.findMany as Mock).mockResolvedValue([
      { conceptoId: 'c1', tenantId: 'tenant-1', nombre: 'Combustible', descripcion: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { conceptoId: 'c2', tenantId: 'tenant-1', nombre: 'Viejo', descripcion: null, isActive: false, createdAt: new Date(), updatedAt: new Date() },
    ])

    const response = await getConcepts(new NextRequest('http://localhost/api/mobile/expense-concepts'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items[0]).toMatchObject({ conceptoId: 'c1', nombre: 'Combustible', estado: 'ACTIVO' })
    expect(data.items[1]).toMatchObject({ conceptoId: 'c2', estado: 'INACTIVO' })
  })

  it('POST /api/mobile/expense-concepts crea concepto', async () => {
    ;(prismaMock.gastoConcepto.create as Mock).mockResolvedValue({
      conceptoId: 'c3',
      tenantId: 'tenant-1',
      nombre: 'Oficina',
      descripcion: 'Suministros',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new NextRequest('http://localhost/api/mobile/expense-concepts', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Oficina', descripcion: 'Suministros' }),
    })
    const response = await createConcept(request)

    expect(response.status).toBe(201)
    expect(prismaMock.gastoConcepto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', nombre: 'Oficina' }) }),
    )
  })

  it('PUT /api/mobile/expense-concepts/:id mapea estado ACTIVO/INACTIVO a isActive', async () => {
    ;(prismaMock.gastoConcepto.findUnique as Mock).mockResolvedValue({ conceptoId: 'c1', tenantId: 'tenant-1' })
    ;(prismaMock.gastoConcepto.update as Mock).mockResolvedValue({
      conceptoId: 'c1',
      tenantId: 'tenant-1',
      nombre: 'Combustible',
      descripcion: null,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new NextRequest('http://localhost/api/mobile/expense-concepts/c1', {
      method: 'PUT',
      body: JSON.stringify({ estado: 'INACTIVO' }),
    })
    const response = await updateConcept(request, ctx('c1'))

    expect(response.status).toBe(200)
    expect(prismaMock.gastoConcepto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    )
  })

  it('DELETE /api/mobile/expense-concepts/:id desactiva si tiene gastos, borra si no', async () => {
    ;(prismaMock.gastoConcepto.findUnique as Mock).mockResolvedValue({ conceptoId: 'c1', tenantId: 'tenant-1' })
    ;(prismaMock.gastosDE.count as Mock).mockResolvedValue(3)
    ;(prismaMock.gastoConcepto.update as Mock).mockResolvedValue({ conceptoId: 'c1', isActive: false })

    const response = await deleteConcept(new NextRequest('http://localhost/api/mobile/expense-concepts/c1'), ctx('c1'))
    expect(response.status).toBe(200)
    expect(prismaMock.gastoConcepto.update).toHaveBeenCalled()
    expect(prismaMock.gastoConcepto.delete).not.toHaveBeenCalled()

    vi.clearAllMocks()
    ;(prismaMock.gastoConcepto.findUnique as Mock).mockResolvedValue({ conceptoId: 'c1', tenantId: 'tenant-1' })
    ;(prismaMock.gastosDE.count as Mock).mockResolvedValue(0)
    ;(prismaMock.gastoConcepto.delete as Mock).mockResolvedValue({ conceptoId: 'c1' })

    const response2 = await deleteConcept(new NextRequest('http://localhost/api/mobile/expense-concepts/c1'), ctx('c1'))
    expect(response2.status).toBe(200)
    expect(prismaMock.gastoConcepto.delete).toHaveBeenCalled()
  })
})
