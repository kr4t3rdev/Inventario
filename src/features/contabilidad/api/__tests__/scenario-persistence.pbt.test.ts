import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import prisma from '@/lib/prisma'

/**
 * @description Property-Based Tests para persistencia de escenarios
 * Feature: dashboard-inteligencia-cambiaria, Property 16: Scenario Save and Load Round-Trip
 * Validates: Requirements 8.6
 */

// Generadores de datos para escenarios
const moneda_arbitrary = fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN', 'JPY', 'CNY')

const tasas_simuladas_arbitrary = fc.dictionary(
  moneda_arbitrary,
  fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  { minKeys: 1, maxKeys: 5 }
)

const alerta_arbitrary = fc.record({
  tipo: fc.constantFrom('cost_increase', 'unrealized_loss', 'banking_spread', 'break_even', 'margin_difference'),
  mensaje: fc.string({ minLength: 10, maxLength: 200 }),
  severidad: fc.constantFrom('info', 'warning', 'critical')
})

const resultados_arbitrary = fc.record({
  costo_reposicion_proyectado: fc.float({ min: Math.fround(0), max: Math.fround(10000000), noNaN: true }),
  perdida_no_realizada_proyectada: fc.float({ min: Math.fround(-1000000), max: Math.fround(1000000), noNaN: true }),
  margen_real_proyectado: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
  utilidad_neta_proyectada: fc.float({ min: Math.fround(-1000000), max: Math.fround(10000000), noNaN: true })
})

const escenario_arbitrary = fc.record({
  nombre: fc.string({ minLength: 3, maxLength: 100 }).filter((value) => value.trim().length >= 3),
  descripcion: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: null }),
  tasas_simuladas: tasas_simuladas_arbitrary,
  fecha_proyeccion: fc
    .date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
    .filter((value) => !Number.isNaN(value.getTime())),
  resultados: resultados_arbitrary,
  alertas: fc.array(alerta_arbitrary, { minLength: 0, maxLength: 10 }),
  etiquetas: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  es_favorito: fc.boolean()
})

describe('Scenario Persistence - Property-Based Tests', () => {
  const usuario_id_test = 'test-user-id'
  const escenarios_creados: string[] = []

  afterEach(async () => {
    // Limpiar escenarios creados durante los tests
    if (escenarios_creados.length > 0) {
      await prisma.scenarioSimulation.deleteMany({
        where: {
          id: {
            in: escenarios_creados
          }
        }
      })
      escenarios_creados.length = 0
    }
  })

  /**
   * @description Property 16: Scenario Save and Load Round-Trip
   * Para cualquier escenario válido, guardar y luego cargar debe producir un escenario equivalente
   */
  it('Property 16: load(save(scenario)) debe producir un escenario equivalente', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          // SAVE: Guardar el escenario
          const escenario_guardado = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })

          // Registrar para limpieza
          escenarios_creados.push(escenario_guardado.id)

          // LOAD: Cargar el escenario
          const escenario_cargado = await prisma.scenarioSimulation.findUnique({
            where: { id: escenario_guardado.id }
          })

          // Verificar que se cargó correctamente
          expect(escenario_cargado).not.toBeNull()

          if (escenario_cargado) {
            // Parsear campos JSON
            const tasas_cargadas = JSON.parse(escenario_cargado.tasasSimuladas)
            const resultados_cargados = JSON.parse(escenario_cargado.resultados)
            const alertas_cargadas = JSON.parse(escenario_cargado.alertas || '[]')
            const etiquetas_cargadas = JSON.parse(escenario_cargado.etiquetas || '[]')

            // VERIFICAR EQUIVALENCIA: Todos los campos deben coincidir
            expect(escenario_cargado.nombre).toBe(escenario_original.nombre)
            expect(escenario_cargado.descripcion).toBe(escenario_original.descripcion)
            expect(escenario_cargado.esFavorito).toBe(escenario_original.es_favorito)
            expect(escenario_cargado.creadoPor).toBe(usuario_id_test)

            // Verificar fecha de proyección (comparar timestamps para evitar problemas de zona horaria)
            expect(escenario_cargado.fechaProyeccion.getTime()).toBe(
              escenario_original.fecha_proyeccion.getTime()
            )

            // Verificar tasas simuladas (objeto completo)
            expect(Object.keys(tasas_cargadas).length).toBe(
              Object.keys(escenario_original.tasas_simuladas).length
            )
            for (const [moneda, tasa] of Object.entries(escenario_original.tasas_simuladas)) {
              expect(tasas_cargadas[moneda]).toBeCloseTo(tasa as number, 5)
            }

            // Verificar resultados (todos los campos numéricos)
            expect(resultados_cargados.costo_reposicion_proyectado).toBeCloseTo(
              escenario_original.resultados.costo_reposicion_proyectado,
              5
            )
            expect(resultados_cargados.perdida_no_realizada_proyectada).toBeCloseTo(
              escenario_original.resultados.perdida_no_realizada_proyectada,
              5
            )
            expect(resultados_cargados.margen_real_proyectado).toBeCloseTo(
              escenario_original.resultados.margen_real_proyectado,
              5
            )
            expect(resultados_cargados.utilidad_neta_proyectada).toBeCloseTo(
              escenario_original.resultados.utilidad_neta_proyectada,
              5
            )

            // Verificar alertas (array completo)
            expect(alertas_cargadas.length).toBe(escenario_original.alertas.length)
            for (let i = 0; i < escenario_original.alertas.length; i++) {
              expect(alertas_cargadas[i].tipo).toBe(escenario_original.alertas[i].tipo)
              expect(alertas_cargadas[i].mensaje).toBe(escenario_original.alertas[i].mensaje)
              expect(alertas_cargadas[i].severidad).toBe(escenario_original.alertas[i].severidad)
            }

            // Verificar etiquetas (array completo)
            expect(etiquetas_cargadas.length).toBe(escenario_original.etiquetas.length)
            for (let i = 0; i < escenario_original.etiquetas.length; i++) {
              expect(etiquetas_cargadas[i]).toBe(escenario_original.etiquetas[i])
            }

            // Verificar que se generaron campos automáticos
            expect(escenario_cargado.id).toBeDefined()
            expect(escenario_cargado.fechaCreacion).toBeInstanceOf(Date)
            expect(escenario_cargado.ultimaModificacion).toBeInstanceOf(Date)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * @description Property: Múltiples ciclos de save/load producen resultados consistentes
   * Guardar, cargar, guardar de nuevo, cargar de nuevo debe producir el mismo resultado
   */
  it('Múltiples ciclos de save/load deben producir resultados consistentes', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          // Primer ciclo: SAVE -> LOAD
          const escenario_guardado_1 = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })
          escenarios_creados.push(escenario_guardado_1.id)

          const escenario_cargado_1 = await prisma.scenarioSimulation.findUnique({
            where: { id: escenario_guardado_1.id }
          })

          expect(escenario_cargado_1).not.toBeNull()

          // Segundo ciclo: SAVE (con datos del primer load) -> LOAD
          if (escenario_cargado_1) {
            const escenario_guardado_2 = await prisma.scenarioSimulation.create({
              data: {
                nombre: escenario_cargado_1.nombre,
                descripcion: escenario_cargado_1.descripcion,
                tasasSimuladas: escenario_cargado_1.tasasSimuladas,
                fechaProyeccion: escenario_cargado_1.fechaProyeccion,
                resultados: escenario_cargado_1.resultados,
                alertas: escenario_cargado_1.alertas,
                etiquetas: escenario_cargado_1.etiquetas,
                esFavorito: escenario_cargado_1.esFavorito,
                creadoPor: usuario_id_test
              }
            })
            escenarios_creados.push(escenario_guardado_2.id)

            const escenario_cargado_2 = await prisma.scenarioSimulation.findUnique({
              where: { id: escenario_guardado_2.id }
            })

            expect(escenario_cargado_2).not.toBeNull()

            // Verificar que ambos loads producen datos equivalentes
            if (escenario_cargado_2) {
              expect(escenario_cargado_2.nombre).toBe(escenario_cargado_1.nombre)
              expect(escenario_cargado_2.descripcion).toBe(escenario_cargado_1.descripcion)
              expect(escenario_cargado_2.tasasSimuladas).toBe(escenario_cargado_1.tasasSimuladas)
              expect(escenario_cargado_2.resultados).toBe(escenario_cargado_1.resultados)
              expect(escenario_cargado_2.alertas).toBe(escenario_cargado_1.alertas)
              expect(escenario_cargado_2.etiquetas).toBe(escenario_cargado_1.etiquetas)
              expect(escenario_cargado_2.esFavorito).toBe(escenario_cargado_1.esFavorito)
              expect(escenario_cargado_2.fechaProyeccion.getTime()).toBe(
                escenario_cargado_1.fechaProyeccion.getTime()
              )
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * @description Property: Metadata (nombre, fecha, descripción) se preserva exactamente
   */
  it('Metadata del escenario debe preservarse exactamente después de save/load', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          const escenario_guardado = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })
          escenarios_creados.push(escenario_guardado.id)

          const escenario_cargado = await prisma.scenarioSimulation.findUnique({
            where: { id: escenario_guardado.id }
          })

          expect(escenario_cargado).not.toBeNull()

          if (escenario_cargado) {
            // Verificar metadata exacta
            expect(escenario_cargado.nombre).toBe(escenario_original.nombre)
            expect(escenario_cargado.descripcion).toBe(escenario_original.descripcion)
            expect(escenario_cargado.fechaProyeccion.toISOString()).toBe(
              escenario_original.fecha_proyeccion.toISOString()
            )
            expect(escenario_cargado.esFavorito).toBe(escenario_original.es_favorito)
            expect(escenario_cargado.creadoPor).toBe(usuario_id_test)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * @description Property: Todas las tasas simuladas se preservan con precisión
   */
  it('Todas las tasas simuladas deben preservarse con precisión después de save/load', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          const escenario_guardado = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })
          escenarios_creados.push(escenario_guardado.id)

          const escenario_cargado = await prisma.scenarioSimulation.findUnique({
            where: { id: escenario_guardado.id }
          })

          expect(escenario_cargado).not.toBeNull()

          if (escenario_cargado) {
            const tasas_cargadas = JSON.parse(escenario_cargado.tasasSimuladas)

            // Verificar que todas las monedas están presentes
            const monedas_originales = Object.keys(escenario_original.tasas_simuladas)
            const monedas_cargadas = Object.keys(tasas_cargadas)

            expect(monedas_cargadas.length).toBe(monedas_originales.length)

            // Verificar cada tasa individualmente
            for (const moneda of monedas_originales) {
              expect(tasas_cargadas).toHaveProperty(moneda)
              expect(tasas_cargadas[moneda]).toBeCloseTo(
                escenario_original.tasas_simuladas[moneda],
                5
              )
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * @description Property: Todas las proyecciones calculadas se preservan
   */
  it('Todas las proyecciones calculadas deben preservarse después de save/load', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          const escenario_guardado = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })
          escenarios_creados.push(escenario_guardado.id)

          const escenario_cargado = await prisma.scenarioSimulation.findUnique({
            where: { id: escenario_guardado.id }
          })

          expect(escenario_cargado).not.toBeNull()

          if (escenario_cargado) {
            const resultados_cargados = JSON.parse(escenario_cargado.resultados)

            // Verificar cada campo de resultados
            expect(resultados_cargados.costo_reposicion_proyectado).toBeCloseTo(
              escenario_original.resultados.costo_reposicion_proyectado,
              5
            )
            expect(resultados_cargados.perdida_no_realizada_proyectada).toBeCloseTo(
              escenario_original.resultados.perdida_no_realizada_proyectada,
              5
            )
            expect(resultados_cargados.margen_real_proyectado).toBeCloseTo(
              escenario_original.resultados.margen_real_proyectado,
              5
            )
            expect(resultados_cargados.utilidad_neta_proyectada).toBeCloseTo(
              escenario_original.resultados.utilidad_neta_proyectada,
              5
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * @description Property: Campos automáticos (ID, timestamps) se generan correctamente
   */
  it('Campos automáticos deben generarse correctamente en save', async () => {
    await fc.assert(
      fc.asyncProperty(
        escenario_arbitrary,
        async (escenario_original) => {
          const antes_de_guardar = new Date()

          const escenario_guardado = await prisma.scenarioSimulation.create({
            data: {
              nombre: escenario_original.nombre,
              descripcion: escenario_original.descripcion,
              tasasSimuladas: JSON.stringify(escenario_original.tasas_simuladas),
              fechaProyeccion: escenario_original.fecha_proyeccion,
              resultados: JSON.stringify(escenario_original.resultados),
              alertas: JSON.stringify(escenario_original.alertas),
              etiquetas: JSON.stringify(escenario_original.etiquetas),
              esFavorito: escenario_original.es_favorito,
              creadoPor: usuario_id_test
            }
          })
          escenarios_creados.push(escenario_guardado.id)

          const despues_de_guardar = new Date()

          // Verificar que se generó un ID
          expect(escenario_guardado.id).toBeDefined()
          expect(typeof escenario_guardado.id).toBe('string')
          expect(escenario_guardado.id.length).toBeGreaterThan(0)

          // Verificar que se generaron timestamps
          expect(escenario_guardado.fechaCreacion).toBeInstanceOf(Date)
          expect(escenario_guardado.ultimaModificacion).toBeInstanceOf(Date)

          // Verificar que los timestamps están en el rango correcto
          expect(escenario_guardado.fechaCreacion.getTime()).toBeGreaterThanOrEqual(
            antes_de_guardar.getTime() - 1000
          )
          expect(escenario_guardado.fechaCreacion.getTime()).toBeLessThanOrEqual(
            despues_de_guardar.getTime() + 1000
          )

          // Verificar que fechaCreacion y ultimaModificacion son iguales en creación
          expect(escenario_guardado.fechaCreacion.getTime()).toBe(
            escenario_guardado.ultimaModificacion.getTime()
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})
