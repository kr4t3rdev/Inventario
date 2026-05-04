'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function VerifyEmailContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Verificando tu correo...')

  const tokenFromUrl = searchParams.get('token')

  const verify = useCallback(async (token: string): Promise<void> => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': generateUUID(),
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'No se pudo verificar el correo.')
        return
      }

      sessionStorage.setItem('onboardingToken', data.onboardingToken)
      router.replace('/onboarding')
    } catch (err) {
      console.error('Error verificando email:', err)
      setMessage('Error de conexión. Intentalo de nuevo.')
    }
  }, [router])

  useEffect(() => {
    if (!tokenFromUrl) return
    void verify(tokenFromUrl)
  }, [tokenFromUrl, verify])

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Verificación de correo</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

/**
 * @description Pantalla de verificación de email wrappeada en Suspense para useSearchParams.
 * @returns {JSX.Element} Vista de verificación y redirección.
 */
export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-xl border bg-white p-8 shadow-sm">
            <h1 className="mb-2 text-2xl font-semibold">Verificación de correo</h1>
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
