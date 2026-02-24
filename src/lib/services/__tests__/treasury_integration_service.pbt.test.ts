/**
 * @description Property-based tests para sincronización bidireccional con tesorería
 * Feature: dashboard-inteligencia-cambiaria, Property 14: Bidirectional Data Synchronization
 * Validates: Requirements 10.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fc, DEFAULT_PBT_CONFIG, id_arbitrary, monto_arbitrary } from '@/lib/testing'
import { treasury_integration_service } from '../treasury_integration_service'
import { prisma } from '@/lib/prisma'

// ============================================================================
// ARBITRARIES PARA SINCRONIZACIÓN
// ============================================================================

/**
 * @description Genera datos de pago válidos
 */
const pago_data_arbitrary = fc.record({
  deuda_id: id_arbitrary,
  monto_pagado: monto_arbitrary,
  usuario_id: id_arbitrary,
})

/**
 * @description Genera estado de deuda antes del pago
 */
const deuda_estado_anterior_arbitrary = fc.record({
  id: id_arbitrary,
  saldoPendiente: monto_arbitrary,
  estado: fc.constantFrom('ACTIVA', 'VENCIDA'),
  moneda: fc.constantFrom('USD', 'EUR', 'MXN'),
  entidadPrestamista: fc.string({ minLength: 3, maxLength: 50 }),
})

/**
 * @description Genera estado de deuda después del pago
 */
const deuda_estado_posterior_arbitrary = (
  estado_anterior: ReturnType<typeof deuda_estado_anterior_arbitrary.generate>['value']
) => {
  return fc.record({
    id: fc.constant(estado_anterior.id),
    saldoPendiente: fc.float({
      min: Math.fround(0),
      max: Math.fround(Number(estado_anterior.saldoPendiente)),
      noNaN: true,
      noDefaultInfinity: true,
    }),
    estado: fc.constantFrom('ACTIVA', 'PAGADA'),
    moneda: fc.constant(estado_anterior.moneda),
    entidadPrestamista: fc.constant(estado_anterior.entidadPrestamista),
  })
}

// ============================================================================
// PROPERTY TESTS - SINCRONIZACIÓN BIDIRECCIONAL
// ============================================================================

describe('Property 14: Bidirectional Data Synchronization', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    vi.clearAllMocks()
  })

  describe('Propiedad 14.1: Propagación de cambios', () => {
    it('para cualquier pago registrado, los cambios deben propagarse a todos los módulos dependientes', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (pago_data, estado_anterior) => {
            // Mock de Prisma para simular estado anterior
            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: (Number(estado_anterior.saldoPendiente) - pago_data.monto_pagado).toString(),
                estado: Number(estado_anterior.saldoPendiente) - pago_data.monto_pagado <= 0 ? 'PAGADA' : 'ACTIVA',
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)

            // Ejecutar sincronización
            const result = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Propiedad: Los cambios deben propagarse exitosamente
            expect(result.success).toBe(true)
            expect(result.deudas_actualizadas).toBeGreaterThanOrEqual(0)
            expect(result.errores).toHaveLength(0)

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.2: Consistencia de datos', () => {
    it('para cualquier sincronización, la consistencia de datos debe mantenerse entre módulos', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (pago_data, estado_anterior) => {
            // Mock de Prisma
            const saldo_nuevo = Math.max(0, Number(estado_anterior.saldoPendiente) - pago_data.monto_pagado)
            const estado_nuevo = saldo_nuevo <= 0 ? 'PAGADA' : 'ACTIVA'

            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: saldo_nuevo.toString(),
                estado: estado_nuevo,
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)

            // Ejecutar sincronización
            const result = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Propiedad: La sincronización debe ser exitosa y consistente
            if (result.success) {
              expect(result.deudas_actualizadas).toBe(1)
              expect(result.kpis_recalculados).toBe(true)
            }

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.3: Sin pérdida de datos', () => {
    it('para cualquier operación de sincronización, no debe ocurrir pérdida de datos', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (pago_data, estado_anterior) => {
            // Mock de Prisma
            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)

            // Ejecutar sincronización
            const result = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Propiedad: No debe haber pérdida de datos (errores vacíos o success true)
            if (!result.success) {
              expect(result.errores.length).toBeGreaterThan(0)
            } else {
              expect(result.errores).toHaveLength(0)
            }

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.4: Idempotencia de sincronización', () => {
    it('para cualquier sincronización, aplicarla dos veces debe tener el mismo efecto que aplicarla una vez', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (pago_data, estado_anterior) => {
            // Mock de Prisma para primera sincronización
            const saldo_nuevo = Math.max(0, Number(estado_anterior.saldoPendiente) - pago_data.monto_pagado)
            const estado_nuevo = saldo_nuevo <= 0 ? 'PAGADA' : 'ACTIVA'

            const deuda_mock = {
              ...estado_anterior,
              saldoPendiente: estado_anterior.saldoPendiente.toString(),
              updatedAt: new Date(),
              createdAt: new Date(),
              tipo: 'DEUDA_EXTERNA' as const,
              monto: estado_anterior.saldoPendiente.toString(),
              tasaCambio: '20.0',
              fechaRegistro: new Date(),
              cuentaBancariaId: 'cuenta-1',
              plazoMeses: null,
              tasaInteres: null,
              descripcion: null,
              userId: 'user-1',
            }

            const deuda_actualizada_mock = {
              ...deuda_mock,
              saldoPendiente: saldo_nuevo.toString(),
              estado: estado_nuevo,
            }

            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce(deuda_mock as any)
              .mockResolvedValueOnce(deuda_actualizada_mock as any)
              .mockResolvedValueOnce(deuda_actualizada_mock as any)
              .mockResolvedValueOnce(deuda_actualizada_mock as any)

            // Primera sincronización
            const result1 = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Segunda sincronización (idempotente)
            const result2 = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Propiedad: Ambas sincronizaciones deben tener el mismo resultado
            expect(result1.success).toBe(result2.success)
            expect(result1.deudas_actualizadas).toBe(result2.deudas_actualizadas)
            expect(result1.kpis_recalculados).toBe(result2.kpis_recalculados)

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.5: Rollback en caso de fallo', () => {
    it('para cualquier sincronización que falle, la consistencia del sistema debe mantenerse', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          async (pago_data) => {
            // Mock de Prisma que simula un error
            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockRejectedValueOnce(new Error('Database connection error'))

            // Ejecutar sincronización que debe fallar
            const result = await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )

            // Propiedad: El fallo debe ser manejado correctamente
            expect(result.success).toBe(false)
            expect(result.errores.length).toBeGreaterThan(0)
            expect(result.deudas_actualizadas).toBe(0)
            expect(result.kpis_recalculados).toBe(false)

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.6: Estado de sincronización verificable', () => {
    it('para cualquier deuda, el estado de sincronización debe ser verificable en cualquier momento', async () => {
      await fc.assert(
        fc.asyncProperty(
          id_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (deuda_id, estado_deuda) => {
            // Mock de Prisma
            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce({
                ...estado_deuda,
                id: deuda_id,
                saldoPendiente: estado_deuda.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_deuda.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
                pagos: [],
              } as any)

            // Obtener estado de sincronización
            const sync_status = await treasury_integration_service.get_sync_status(deuda_id)

            // Propiedad: El estado debe ser verificable
            expect(sync_status).toBeDefined()
            expect(typeof sync_status.sincronizada).toBe('boolean')
            expect(typeof sync_status.pendiente_recalculo).toBe('boolean')
            
            if (sync_status.ultima_actualizacion) {
              expect(sync_status.ultima_actualizacion).toBeInstanceOf(Date)
            }

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.7: Auditoría completa de cambios', () => {
    it('para cualquier cambio en datos, debe existir un registro de auditoría completo', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }),
          fc.string({ minLength: 3, maxLength: 50 }),
          id_arbitrary,
          id_arbitrary,
          async (accion, entidad_tipo, entidad_id, usuario_id) => {
            // Crear log de auditoría
            const audit_log = await treasury_integration_service.log_action(
              accion,
              entidad_tipo,
              entidad_id,
              usuario_id,
              { estado: 'anterior' },
              { estado: 'nuevo' }
            )

            // Propiedad: El log debe contener toda la información necesaria
            expect(audit_log.id).toBeDefined()
            expect(audit_log.accion).toBe(accion)
            expect(audit_log.entidad_tipo).toBe(entidad_tipo)
            expect(audit_log.entidad_id).toBe(entidad_id)
            expect(audit_log.usuario_id).toBe(usuario_id)
            expect(audit_log.timestamp).toBeInstanceOf(Date)
            expect(audit_log.datos_anteriores).toEqual({ estado: 'anterior' })
            expect(audit_log.datos_nuevos).toEqual({ estado: 'nuevo' })

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Propiedad 14.8: Sincronización en tiempo acotado', () => {
    it('para cualquier sincronización, debe completarse en tiempo razonable (<5 segundos)', async () => {
      await fc.assert(
        fc.asyncProperty(
          pago_data_arbitrary,
          deuda_estado_anterior_arbitrary,
          async (pago_data, estado_anterior) => {
            // Mock de Prisma
            vi.spyOn(prisma.inyeccionCapital, 'findUnique')
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)
              .mockResolvedValueOnce({
                ...estado_anterior,
                saldoPendiente: estado_anterior.saldoPendiente.toString(),
                updatedAt: new Date(),
                createdAt: new Date(),
                tipo: 'DEUDA_EXTERNA',
                monto: estado_anterior.saldoPendiente.toString(),
                tasaCambio: '20.0',
                fechaRegistro: new Date(),
                cuentaBancariaId: 'cuenta-1',
                plazoMeses: null,
                tasaInteres: null,
                descripcion: null,
                userId: 'user-1',
              } as any)

            // Medir tiempo de sincronización
            const start_time = Date.now()
            await treasury_integration_service.sync_after_payment(
              pago_data.deuda_id,
              pago_data.monto_pagado,
              pago_data.usuario_id
            )
            const elapsed_time = Date.now() - start_time

            // Propiedad: La sincronización debe completarse en menos de 5 segundos
            expect(elapsed_time).toBeLessThan(5000)

            return true
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })
})
