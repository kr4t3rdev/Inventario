import { describe, it, expect } from 'vitest'
import { ServerActionError } from '@/lib/api/errors'
import { handleServerActionError } from './error-handler'

describe('handleServerActionError', () => {
  it('should re-throw ServerActionError as-is', () => {
    const original = new ServerActionError(
      'testAction',
      'GET',
      403,
      'Forbidden'
    )

    try {
      handleServerActionError(original, 'testAction')
      // Si llegó acá es porque no tiró error → fail
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBe(original)
      expect(error instanceof ServerActionError).toBe(true)
      expect((error as ServerActionError).status).toBe(403)
      expect((error as ServerActionError).message).toBe('Forbidden')
    }
  })

  it('should wrap regular Error in ServerActionError with status 500', () => {
    const regularError = new Error('Network failure')

    try {
      handleServerActionError(regularError, 'fetchData')
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).endpoint).toBe('fetchData')
      expect((error as ServerActionError).method).toBe('UNKNOWN')
      expect((error as ServerActionError).status).toBe(500)
      expect((error as ServerActionError).message).toBe('Network failure')
      expect((error as ServerActionError).originalError).toBe(regularError)
    }
  })

  it('should wrap unknown error with generic message', () => {
    try {
      handleServerActionError('something random', 'processData')
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).endpoint).toBe('processData')
      expect((error as ServerActionError).method).toBe('UNKNOWN')
      expect((error as ServerActionError).status).toBe(500)
      expect((error as ServerActionError).message).toBe(
        'An unexpected error occurred'
      )
    }
  })

  it('should wrap null error with generic message', () => {
    try {
      handleServerActionError(null, 'nullAction')
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).message).toBe(
        'An unexpected error occurred'
      )
    }
  })

  it('should wrap undefined error with generic message', () => {
    try {
      handleServerActionError(undefined, 'undefinedAction')
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).message).toBe(
        'An unexpected error occurred'
      )
    }
  })

  it('should always throw (never return)', () => {
    // Esto verifica que la función nunca devuelve un valor
    const result: undefined = (() => {
      try {
        handleServerActionError(new Error('test'), 'neverTest')
      } catch {
        return undefined
      }
      return 'should not reach' as unknown as undefined
    })()

    expect(result).toBeUndefined()
  })
})
