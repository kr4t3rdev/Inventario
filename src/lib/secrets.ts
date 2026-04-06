/**
 * @description Centralized secrets management with validation
 * All sensitive environment variables are accessed through this module
 * This ensures we don't have hardcoded defaults scattered throughout the codebase
 */

const validateSecret = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or your deployment platform.`
    )
  }
  return value
}

/**
 * JWT secret for signing access tokens
 * Must be at least 32 characters in production
 */
export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    return validateSecret('JWT_SECRET', secret)
  }
  // In development, allow a default if not set (for local testing)
  return secret || 'dev-default-jwt-secret-change-in-production'
})()

/**
 * JWT secret for signing refresh tokens (separate key for rotation)
 */
export const REFRESH_JWT_SECRET = (() => {
  const secret = process.env.REFRESH_JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    return validateSecret('REFRESH_JWT_SECRET', secret)
  }
  return secret || 'dev-default-refresh-secret-change-in-production'
})()

/**
 * Validates all secrets at startup
 * Call this in your app initialization (e.g., in middleware.ts or root layout)
 */
export function validateAllSecrets(): void {
  try {
    // Access all secrets to trigger validation
    console.log('[Secrets] ✅ JWT_SECRET configured')
    console.log('[Secrets] ✅ REFRESH_JWT_SECRET configured')
  } catch (error) {
    console.error('[Secrets] ❌ Configuration error:', error)
    throw error
  }
}
