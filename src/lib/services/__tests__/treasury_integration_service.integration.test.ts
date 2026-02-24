/**
 * @description Integration tests para el servicio de integración con tesorería
 * Valida la navegación, pre-llenado de formularios y actualización de KPIs
 * 
 * Feature: dashboard-inteligencia-cambiaria
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TreasuryIntegrationService } from '../treasury_integration_service'
import type { DeudaPriorizada } from '@/types/exchange-intelligence'
import type { InyeccionCapital } from '@/app/models/model'

// ============================================================================
// MOCKS
// ============================================================================

// Mock de Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    inyeccionCapital: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    notificacion: {
      create: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}))

import { prisma } from '@/lib/prisma'

// ============================================================================
// SETUP Y HELPERS
// ============================================================================

/**
 * @description Crea una deuda mock para pruebas
 */
function create_mock_debt(overrides = {}): InyeccionCapital {
  return {
    id: 'test-deuda-' + Math.random().toString(36).substr(2, 9),
    tipo: 'DEUDA_EXTERNA',
    montoRecibido: 10000,
    moneda: 'USD',
    entidadPrestamista: 'Banco Test',
    fechaRecepcion: new Date('2023-01-01'),
    plazoMeses: 12,
    tasaInteres: 5.5,
    saldoPendiente: 8000,
    estado: 'ACTIVA',
    cuentaBancariaId: 'test-cuenta-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as InyeccionCapital
}

/**
 * @description Crea una deuda priorizada de prueba
 */
function create_prioritized_debt(deuda_id: string, overrides = {}): DeudaPriorizada {
  return {
    deuda_id,
    entidad: 'Banco Test',
    moneda: 'USD',
    monto: 8000,
    antiguedad_dias: 180,
    tendencia_moneda: 'alcista',
    tendencia_porcentaje: 5.2,
    prioridad: 0.85,
    impacto_30_dias: 416,
    ...overrides
  }
}

// ============================================================================
// TESTS DE INTEGRACIÓN
// ============================================================================

describe('TreasuryIntegrationService - Integration Tests', () => {
  let service: TreasuryIntegrationService

  beforeEach(() => {
    service = new TreasuryIntegrationService()
    vi.clearAllMocks()
  })

  // ==========================================================================
  // TEST 1: NAVEGACIÓN AL MÓDULO DE PAGOS
  // Requirements: 10.1
  // ==========================================================================

  describe('Navegación al módulo de pagos', () => {
    it('debe generar URL correcta con parámetros de navegación', () => {
      const deuda_id = 'test-deuda-123'
      
      const url = service.generate_navigation_url(deuda_id)
      
      expect(url).toContain('/busy/contabilidad/capital')
      expect(url).toContain('action=pagar')
      expect(url).toContain(`deuda_id=${deuda_id}`)
      expect(url).toContain('source=exchange-intelligence')
    })

    it('debe generar URLs únicas para diferentes deudas', () => {
      const deuda_id_1 = 'deuda-001'
      const deuda_id_2 = 'deuda-002'
      
      const url_1 = service.generate_navigation_url(deuda_id_1)
      const url_2 = service.generate_navigation_url(deuda_id_2)
      
      expect(url_1).not.toBe(url_2)
      expect(url_1).toContain(deuda_id_1)
      expect(url_2).toContain(deuda_id_2)
    })

    it('debe validar elegibilidad de pago antes de navegar', async () => {
      const deuda = create_mock_debt({
        estado: 'ACTIVA',
        saldoPendiente: 5000
      })
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const result = await service.validate_payment_eligibility(deuda.id)
      
      expect(result.eligible).toBe(true)
      expect(result.deuda).toBeDefined()
      expect(result.deuda?.id).toBe(deuda.id)
    })

    it('debe rechazar navegación para deudas ya pagadas', async () => {
      const deuda = create_mock_debt({
        estado: 'PAGADA',
        saldoPendiente: 0
      })
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const result = await service.validate_payment_eligibility(deuda.id)
      
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('ya está pagada')
    })
  })

  // ==========================================================================
  // TEST 2: PRE-LLENADO DE FORMULARIO
  // Requirements: 10.2, 10.3
  // ==========================================================================

  describe('Pre-llenado de formulario de pago', () => {
    it('debe preparar datos completos para formulario de pago', async () => {
      const deuda = create_mock_debt({
        entidadPrestamista: 'Banco Test Alpha',
        montoRecibido: 10000,
        saldoPendiente: 8000,
        moneda: 'USD',
        plazoMeses: 12
      })
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const deuda_priorizada = create_prioritized_debt(deuda.id, {
        entidad: 'Banco Test Alpha',
        monto: 8000,
        prioridad: 0.85
      })
      
      const form_data = await service.prepare_payment_form_data(deuda_priorizada)
      
      expect(form_data.deuda_id).toBe(deuda.id)
      expect(form_data.entidad).toBe('Banco Test Alpha')
      expect(form_data.moneda).toBe('USD')
      expect(form_data.monto_sugerido).toBeGreaterThan(0)
      expect(form_data.descripcion).toContain('Banco Test Alpha')
      expect(form_data.observaciones_recomendadas).toBeTruthy()
    })

    it('debe sugerir pago completo para deudas de alta prioridad', async () => {
      const deuda = create_mock_debt({
        saldoPendiente: 8000,
        plazoMeses: 12
      })
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const deuda_priorizada = create_prioritized_debt(deuda.id, {
        monto: 8000,
        prioridad: 0.9 // Alta prioridad
      })
      
      const form_data = await service.prepare_payment_form_data(deuda_priorizada)
      
      expect(form_data.monto_sugerido).toBe(8000)
      expect(form_data.observaciones_recomendadas).toContain('PRIORIDAD CRÍTICA')
    })

    it('debe incluir recomendaciones basadas en tendencia de moneda', async () => {
      const deuda = create_mock_debt()
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const deuda_priorizada = create_prioritized_debt(deuda.id, {
        tendencia_moneda: 'alcista',
        tendencia_porcentaje: 5.2
      })
      
      const form_data = await service.prepare_payment_form_data(deuda_priorizada)
      
      expect(form_data.observaciones_recomendadas).toContain('tendencia alcista')
      expect(form_data.observaciones_recomendadas).toContain('5.2')
    })

    it('debe lanzar error si la deuda no existe', async () => {
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(null)
      
      const deuda_priorizada = create_prioritized_debt('deuda-inexistente')
      
      await expect(
        service.prepare_payment_form_data(deuda_priorizada)
      ).rejects.toThrow('Deuda no encontrada')
    })
  })

  // ==========================================================================
  // TEST 3: ACTUALIZACIÓN DE KPIs DESPUÉS DE PAGO
  // Requirements: 10.4
  // ==========================================================================

  describe('Actualización de KPIs después de pago', () => {
    it('debe sincronizar datos después de registrar un pago', async () => {
      const deuda = create_mock_debt({
        saldoPendiente: 8000
      })
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const monto_pagado = 2000
      const usuario_id = 'test-user-123'
      
      const result = await service.sync_after_payment(
        deuda.id,
        monto_pagado,
        usuario_id
      )
      
      expect(result.success).toBe(true)
      expect(result.deudas_actualizadas).toBe(1)
      expect(result.kpis_recalculados).toBe(true)
      expect(result.errores).toHaveLength(0)
    })

    it('debe registrar auditoría de pago', async () => {
      const deuda = create_mock_debt()
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(deuda)
      
      const monto_pagado = 1000
      const usuario_id = 'test-user-456'
      
      // Espiar console.log para verificar el registro de auditoría
      const console_spy = vi.spyOn(console, 'log')
      
      await service.sync_after_payment(deuda.id, monto_pagado, usuario_id)
      
      expect(console_spy).toHaveBeenCalledWith(
        '[AUDIT LOG]',
        expect.objectContaining({
          accion: 'registrar_pago_deuda',
          entidad_tipo: 'inyeccion_capital',
          entidad_id: deuda.id,
          usuario_id
        })
      )
      
      console_spy.mockRestore()
    })

    it('debe manejar errores cuando la deuda no existe', async () => {
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(null)
      
      const deuda_id_inexistente = 'deuda-no-existe'
      const monto_pagado = 1000
      const usuario_id = 'test-user-789'
      
      const result = await service.sync_after_payment(
        deuda_id_inexistente,
        monto_pagado,
        usuario_id
      )
      
      expect(result.success).toBe(false)
      expect(result.deudas_actualizadas).toBe(0)
      expect(result.kpis_recalculados).toBe(false)
      expect(result.errores.length).toBeGreaterThan(0)
      expect(result.errores[0]).toContain('no encontrada')
    })

    it('debe obtener estado de sincronización correctamente', async () => {
      const deuda = create_mock_debt()
      
      // Mock con relación de pagos incluida
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue({
        ...deuda,
        pagos: []
      } as any)
      
      const status = await service.get_sync_status(deuda.id)
      
      expect(status.sincronizada).toBe(true)
      expect(status.ultima_actualizacion).toBeInstanceOf(Date)
      expect(typeof status.pendiente_recalculo).toBe('boolean')
    })

    it('debe retornar estado no sincronizado para deudas inexistentes', async () => {
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(null)
      
      const status = await service.get_sync_status('deuda-inexistente')
      
      expect(status.sincronizada).toBe(false)
      expect(status.ultima_actualizacion).toBeNull()
      expect(status.pendiente_recalculo).toBe(false)
    })
  })

  // ==========================================================================
  // TEST 4: FLUJO COMPLETO DE INTEGRACIÓN
  // Requirements: 10.1, 10.2, 10.3, 10.4
  // ==========================================================================

  describe('Flujo completo de integración', () => {
    it('debe completar flujo completo: validar -> preparar -> navegar -> sincronizar', async () => {
      // 1. Crear deuda de prueba
      const deuda = create_mock_debt({
        entidadPrestamista: 'Banco Test Flujo',
        saldoPendiente: 10000
      })
      
      // Mock con relación de pagos incluida
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue({
        ...deuda,
        pagos: []
      } as any)
      
      // 2. Validar elegibilidad
      const validation = await service.validate_payment_eligibility(deuda.id)
      expect(validation.eligible).toBe(true)
      
      // 3. Preparar datos de formulario
      const deuda_priorizada = create_prioritized_debt(deuda.id, {
        entidad: 'Banco Test Flujo',
        monto: 10000
      })
      
      const form_data = await service.prepare_payment_form_data(deuda_priorizada)
      expect(form_data.deuda_id).toBe(deuda.id)
      expect(form_data.monto_sugerido).toBeGreaterThan(0)
      
      // 4. Generar URL de navegación
      const url = service.generate_navigation_url(deuda.id)
      expect(url).toContain(deuda.id)
      
      // 5. Simular pago y sincronizar
      const sync_result = await service.sync_after_payment(
        deuda.id,
        form_data.monto_sugerido,
        'test-user-flujo'
      )
      
      expect(sync_result.success).toBe(true)
      expect(sync_result.kpis_recalculados).toBe(true)
      
      // 6. Verificar estado de sincronización
      const status = await service.get_sync_status(deuda.id)
      expect(status.sincronizada).toBe(true)
    })

    it('debe manejar errores en cualquier paso del flujo', async () => {
      const deuda_id_invalido = 'deuda-invalida-flujo'
      
      vi.mocked(prisma.inyeccionCapital.findUnique).mockResolvedValue(null)
      
      // Validación debe fallar
      const validation = await service.validate_payment_eligibility(deuda_id_invalido)
      expect(validation.eligible).toBe(false)
      
      // Preparación debe fallar
      const deuda_priorizada = create_prioritized_debt(deuda_id_invalido)
      await expect(
        service.prepare_payment_form_data(deuda_priorizada)
      ).rejects.toThrow()
      
      // Sincronización debe fallar
      const sync_result = await service.sync_after_payment(
        deuda_id_invalido,
        1000,
        'test-user'
      )
      expect(sync_result.success).toBe(false)
    })
  })
})
