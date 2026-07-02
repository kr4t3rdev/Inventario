import { describe, expect, it } from 'vitest'

import { getNavUserFallbackLabel } from './nav-user'

describe('getNavUserFallbackLabel', () => {
  it('usa abreviaturas por rol de tenant cuando existen', () => {
    expect(getNavUserFallbackLabel('Dependiente Test', 'dependiente')).toBe('DEP')
    expect(getNavUserFallbackLabel('Economico Test', 'economico')).toBe('ECO')
    expect(getNavUserFallbackLabel('Manager Test', 'manager')).toBe('MGR')
  })

  it('usa ADM para admin global sin rol de tenant', () => {
    expect(getNavUserFallbackLabel('Admin Test', null, 'admin')).toBe('ADM')
  })

  it('cae a iniciales del nombre cuando no hay rol especial', () => {
    expect(getNavUserFallbackLabel('Juan Perez')).toBe('JP')
  })

  it('tolera nombres faltantes o vacíos sin romper hidratación', () => {
    expect(getNavUserFallbackLabel(undefined as unknown as string)).toBe('US')
    expect(getNavUserFallbackLabel('   ')).toBe('US')
  })
})
