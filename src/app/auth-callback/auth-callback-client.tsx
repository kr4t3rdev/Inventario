'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { handleAuthCallback } from '@/features/auth/actions'

/**
 * @description Procesa el callback de autenticación externa (OAuth, Google).
 * En lugar de guardar tokens en sessionStorage, llama a handleAuthCallback
 * Server Action que setea cookies httpOnly desde el servidor.
 *
 * @returns {JSX.Element} Vista de espera mientras se procesa la sesión.
 */
export function AuthCallbackClient() {
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

    // Enviar token al servidor para que setee cookies httpOnly
    handleAuthCallback({ token, refreshToken: refreshToken ?? undefined }).then(
      (result) => {
        if (result.success) {
          const redirectPath = isNewUser ? '/onboarding' : '/busy/dashboard'
          router.push(redirectPath)
        } else {
          router.push('/login?error=callback_failed')
        }
      },
    )
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
