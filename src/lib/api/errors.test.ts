import { describe, it, expect } from 'vitest'
import { ServerActionError } from './errors'

describe('ServerActionError', () => {
  it('should create error with all properties', () => {
    const error = new ServerActionError(
      'getProfile',
      'GET',
      404,
      'Profile not found'
    )

    expect(error.endpoint).toBe('getProfile')
    expect(error.method).toBe('GET')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Profile not found')
    expect(error.name).toBe('ServerActionError')
  })

  it('should create error with original error context', () => {
    const originalError = new Error('Network timeout')
    const error = new ServerActionError(
      'updateProfile',
      'PUT',
      500,
      'Server error',
      originalError
    )

    expect(error.originalError).toBe(originalError)
    expect(error.originalError?.message).toBe('Network timeout')
  })

  it('should be instance of Error', () => {
    const error = new ServerActionError(
      'deleteProfile',
      'DELETE',
      401,
      'Unauthorized'
    )

    expect(error).toBeInstanceOf(Error)
  })

  it('should work with instanceof checks', () => {
    const error = new ServerActionError(
      'createOrder',
      'POST',
      400,
      'Invalid input'
    )

    if (error instanceof ServerActionError) {
      expect(error.endpoint).toBe('createOrder')
    } else {
      throw new Error('instanceof check failed')
    }
  })

  it('should handle 400-level errors (client errors)', () => {
    const error = new ServerActionError(
      'validateEmail',
      'POST',
      400,
      'Invalid email format'
    )

    expect(error.status).toBe(400)
    expect(error.status >= 400 && error.status < 500).toBe(true)
  })

  it('should handle 500-level errors (server errors)', () => {
    const error = new ServerActionError(
      'fetchData',
      'GET',
      500,
      'Internal server error'
    )

    expect(error.status).toBe(500)
    expect(error.status >= 500).toBe(true)
  })

  it('should preserve stack trace', () => {
    const error = new ServerActionError(
      'testAction',
      'POST',
      500,
      'Test error'
    )

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('ServerActionError')
  })
})
