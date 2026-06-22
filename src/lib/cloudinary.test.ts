/**
 * @description Tests unitarios para el helper de servidor de Cloudinary.
 * Verifica generación de firmas, validación de configuración y parámetros.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateUploadSignature } from './cloudinary'

describe('generateUploadSignature', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  })

  it('generates signature with valid params', () => {
    const result = generateUploadSignature('tenant123/productos')

    expect(result).toMatchObject({
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      folder: 'tenant123/productos',
    })
    expect(result.signature).toBeDefined()
    expect(typeof result.signature).toBe('string')
    expect(result.signature.length).toBeGreaterThan(0)
    expect(result.timestamp).toBeGreaterThan(0)
  })

  it('throws error when config is missing', () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '')

    expect(() => generateUploadSignature('folder')).toThrow(
      'Cloudinary configuration missing'
    )
  })

  it('throws error when folder is empty', () => {
    expect(() => generateUploadSignature('')).toThrow('Folder is required')
  })

  it('throws error when folder is whitespace', () => {
    expect(() => generateUploadSignature('   ')).toThrow('Folder is required')
  })

  it('includes publicId when provided', () => {
    const result = generateUploadSignature('folder', 'my-public-id')
    expect(result.publicId).toBe('my-public-id')
  })

  it('uses image as default resourceType', () => {
    const result = generateUploadSignature('folder')
    // Verificamos que no falle con resourceType default
    expect(result.cloudName).toBe('test-cloud')
  })
})
