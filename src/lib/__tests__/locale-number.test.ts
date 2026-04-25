import { describe, expect, it } from 'vitest'

import {
  normalizeLocaleDecimalInput,
  normalizeLocaleDecimalValue,
  parseLocaleNumber,
} from '../locale-number'

describe('locale-number', () => {
  it('normaliza coma decimal en strings de formulario', () => {
    expect(normalizeLocaleDecimalInput('12,5')).toBe('12.5')
  })

  it('elimina espacios laterales al normalizar entrada decimal', () => {
    expect(normalizeLocaleDecimalInput('  12,5  ')).toBe('12.5')
  })

  it('normaliza valores desconocidos solo cuando son string', () => {
    expect(normalizeLocaleDecimalValue('7,25')).toBe('7.25')
    expect(normalizeLocaleDecimalValue(7.25)).toBe(7.25)
  })

  it('parsea correctamente un número con coma decimal', () => {
    expect(parseLocaleNumber('99,95')).toBe(99.95)
  })
})