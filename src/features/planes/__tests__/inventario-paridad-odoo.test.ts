import { describe, expect, it } from 'vitest'
import {
  PLAN_BASICO_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
} from '../../../../prisma/seed/plans-seed'
import { FEATURE_REGISTRY, getEnabledFeatureLabels } from '../feature-registry'

const NUCLEO_KEYS = ['kardex', 'ajustes-inventario', 'conteo-fisico']

const PROFESIONAL_KEYS = [
  'ordenes-compra',
  'recepciones',
  'reabastecimiento',
  'unidades-conversion',
  'lotes-series',
  'variantes',
  'ubicaciones-avanzadas',
]

describe('Inventario paridad Odoo por planes', () => {
  it('declara las claves nuevas en el registry central', () => {
    for (const key of [...NUCLEO_KEYS, ...PROFESIONAL_KEYS, 'mrp-avanzado']) {
      expect(FEATURE_REGISTRY).toContainEqual(expect.objectContaining({ key }))
    }
  })

  it('habilita el núcleo auditable en el plan Básico', () => {
    for (const key of NUCLEO_KEYS) {
      expect(PLAN_BASICO_FEATURES[key]).toBe(true)
    }
  })

  it('reserva P1 y MRP fuera del plan Básico', () => {
    for (const key of [...PROFESIONAL_KEYS, 'mrp-avanzado']) {
      expect(PLAN_BASICO_FEATURES[key]).toBe(false)
    }
  })

  it('habilita P1 en Profesional y reserva MRP a Empresarial', () => {
    for (const key of [...NUCLEO_KEYS, ...PROFESIONAL_KEYS]) {
      expect(PLAN_PROFESIONAL_FEATURES[key]).toBe(true)
    }
    expect(PLAN_PROFESIONAL_FEATURES['mrp-avanzado']).toBe(false)
    expect(PLAN_EMPRESARIAL_FEATURES['mrp-avanzado']).toBe(true)
  })

  it('deriva etiquetas de landing desde el registry', () => {
    const labels = getEnabledFeatureLabels(PLAN_PROFESIONAL_FEATURES)
    expect(labels).toContain('Kardex de inventario')
    expect(getEnabledFeatureLabels(PLAN_BASICO_FEATURES)).not.toContain(
      'Órdenes de compra',
    )
  })
})
