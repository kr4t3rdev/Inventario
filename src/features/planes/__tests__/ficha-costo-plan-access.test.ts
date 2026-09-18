import { describe, expect, it } from 'vitest'
import {
  PLAN_BASICO_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
} from '../../../../prisma/seed/plans-seed'
import { FEATURE_REGISTRY, getEnabledFeatureLabels } from '../feature-registry'

describe('Ficha de Costo plan access', () => {
  it('defines the base feature in the central registry', () => {
    expect(FEATURE_REGISTRY).toContainEqual(expect.objectContaining({
      key: 'ficha-costo',
      label: 'Ficha de Costo',
    }))
  })

  it('enables Ficha de Costo only for Empresarial', () => {
    expect(PLAN_BASICO_FEATURES['ficha-costo']).toBe(false)
    expect(PLAN_PROFESIONAL_FEATURES['ficha-costo']).toBe(false)
    expect(PLAN_EMPRESARIAL_FEATURES['ficha-costo']).toBe(true)
    expect(PLAN_BASICO_FEATURES['ficha-costo-bulk']).toBe(false)
    expect(PLAN_PROFESIONAL_FEATURES['ficha-costo-bulk']).toBe(false)
    expect(PLAN_EMPRESARIAL_FEATURES['ficha-costo-bulk']).toBe(true)
  })

  it('derives the landing label from registry and plan features', () => {
    expect(getEnabledFeatureLabels(PLAN_PROFESIONAL_FEATURES)).not.toContain('Ficha de Costo')
    expect(getEnabledFeatureLabels(PLAN_EMPRESARIAL_FEATURES)).toContain('Ficha de Costo')
  })
})
