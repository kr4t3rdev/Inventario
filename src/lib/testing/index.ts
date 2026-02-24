/**
 * @description Exportaciones centralizadas para utilidades de testing
 */

// Configuración y arbitraries de fast-check
export * from './pbt-config'

// Helpers y utilidades de testing
export * from './test-helpers'

// Re-exportar fast-check para conveniencia
export { default as fc } from 'fast-check'
