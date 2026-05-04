'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type OnboardingUser = {
  userId: string
  name: string
  email: string
  onboardingType: string | null
  onboardingStatus: string
  emailVerifiedAt: string | null
}

type TenantItem = { tenantId: string; nombre: string; slug: string | null }

/**
 * @description Pantalla de onboarding post-verificación para elegir tipo de usuario y tenant.
 * @returns {JSX.Element} Flujo de onboarding básico.
 */
export default function OnboardingPage(): React.JSX.Element {
  const router = useRouter()
  const [user, setUser] = useState<OnboardingUser | null>(null)
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onboardingToken = typeof window !== 'undefined' ? sessionStorage.getItem('onboardingToken') : null

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (!onboardingToken) {
        router.replace('/register')
        return
      }

      const response = await fetch('/api/auth/onboarding/me', {
        headers: {
          Authorization: `Bearer ${onboardingToken}`,
          'x-request-id': typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '',
        },
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'No se pudo cargar el onboarding')
        setLoading(false)
        return
      }

      setUser(data.user)
      setTenants(data.tenants)
      setLoading(false)
    }

    void run()
  }, [onboardingToken, router])

  const canSelectTenant = useMemo(() => user?.onboardingType === 'worker' || user?.onboardingStatus === 'selecting_tenant', [user])

  const chooseType = async (userType: 'worker' | 'company'): Promise<void> => {
    if (!onboardingToken) return
    const response = await fetch('/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${onboardingToken}`,
        'x-request-id': typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '',
      },
      body: JSON.stringify({ userType }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'No se pudo guardar el tipo de usuario')
      return
    }

    setUser((current) => current ? { ...current, onboardingType: userType, onboardingStatus: data.onboardingStatus } : current)
  }

  const chooseTenant = async (tenantId: string): Promise<void> => {
    if (!onboardingToken) return
    const response = await fetch('/api/auth/onboarding/tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${onboardingToken}`,
        'x-request-id': typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '',
      },
      body: JSON.stringify({ tenantId }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'No se pudo asociar la empresa')
      return
    }

    setUser((current) => current ? { ...current, onboardingStatus: 'awaiting_manager_approval' } : current)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Cargando onboarding...</div>
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center">{error}</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Bienvenido, {user.name}</h1>
        <p className="text-muted-foreground">Terminá de configurar tu acceso al sistema.</p>
      </header>

      {!user.onboardingType && (
        <section className="grid gap-4 md:grid-cols-2">
          <button className="rounded-xl border p-6 text-left shadow-sm" onClick={() => void chooseType('worker')}>
            <h2 className="mb-2 text-xl font-semibold">Trabajador</h2>
            <p className="text-sm text-muted-foreground">Accedé a una empresa/tenant como dependiente o económico.</p>
          </button>
          <button className="rounded-xl border p-6 text-left shadow-sm" onClick={() => void chooseType('company')}>
            <h2 className="mb-2 text-xl font-semibold">Empresa</h2>
            <p className="text-sm text-muted-foreground">Configurá tu propia organización como manager.</p>
          </button>
        </section>
      )}

      {user.onboardingType === 'worker' && (
        <section className="rounded-xl border p-6">
          <h2 className="mb-2 text-xl font-semibold">Elegí tu organización</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Si necesitás pertenecer a más de una empresa, comunicáte con el admin global para habilitar multimembresía.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {tenants.map((tenant) => (
              <button key={tenant.tenantId} className="rounded-lg border p-4 text-left" onClick={() => void chooseTenant(tenant.tenantId)}>
                <div className="font-medium">{tenant.nombre}</div>
                <div className="text-sm text-muted-foreground">{tenant.slug || tenant.tenantId}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {user.onboardingStatus === 'awaiting_manager_approval' && (
        <section className="rounded-xl border bg-muted/40 p-6">
          <h2 className="mb-2 text-xl font-semibold">Solicitud enviada</h2>
          <p className="text-sm text-muted-foreground">
            Tu acceso quedó en espera de aprobación por el manager de la empresa seleccionada.
          </p>
        </section>
      )}

      {user.onboardingType === 'company' && (
        <section className="rounded-xl border bg-muted/40 p-6">
          <h2 className="mb-2 text-xl font-semibold">Esperando aprobación global</h2>
          <p className="text-sm text-muted-foreground">
            Comunicate con el admin global para garantizar el acceso y comenzar a configurar tu empresa.
          </p>
        </section>
      )}

      {canSelectTenant && tenants.length === 0 && (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No hay empresas registradas todavía.
        </div>
      )}
    </div>
  )
}
