import { describe, expect, it } from 'vitest'

import { buildAuthHeader } from '../apiSlice'

describe('buildAuthHeader', () => {
  it('preserva un token ya prefijado', () => {
    expect(buildAuthHeader('Bearer abc123')).toBe('Bearer abc123')
  })

  it('prefija un token crudo', () => {
    expect(buildAuthHeader('abc123')).toBe('Bearer abc123')
  })
})
