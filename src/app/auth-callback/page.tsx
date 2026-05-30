import { Suspense } from 'react'

import { AuthCallbackClient } from './auth-callback-client'

/**
 * @description Página que procesa el callback de Google OAuth
 * Toma los tokens de los query params y los guarda, luego redirige al onboarding o dashboard
 * @returns {JSX.Element} Página con fallback de carga
 */

export const metadata = {
  title: "Autenticación - FinanceMDM",
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
            </div>
            <p className="text-white text-lg font-medium">Autenticando...</p>
            <p className="text-slate-400 text-sm mt-2">Redirigiendo en unos momentos...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  )
}
