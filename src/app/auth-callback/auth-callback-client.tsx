'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * @description Procesa el callback de autenticación leyendo query params y redirigiendo.
 * @returns {JSX.Element} Vista de espera mientras se guarda la sesión.
 */
export function AuthCallbackClient(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const refreshToken = searchParams.get('refreshToken')
    const isNewUser = searchParams.get('isNewUser') === 'true'
    const error = searchParams.get('error')

    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`)
      return
    }

    if (!token) {
      router.push('/login?error=no_token')
      return
    }

    // Guardás los tokens en sessionStorage (igual que el interceptor espera)
    sessionStorage.setItem('token', token)
    if (refreshToken) {
      sessionStorage.setItem('refreshToken', refreshToken)
    }

    // Si es usuario nuevo, va al onboarding
    // Si no, va al dashboard
    const redirectPath = isNewUser ? '/onboarding' : '/busy/dashboard'
    router.push(redirectPath)
  }, [searchParams, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
        </div>
        <p className="text-white text-lg font-medium">Autenticando...</p>
        <p className="text-slate-400 text-sm mt-2">Redirigiendo en unos momentos...</p>
      </div>
    </div>
  )
}
