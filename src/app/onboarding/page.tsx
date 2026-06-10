'use client'

import type React from 'react'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { m as motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Building2Icon,
  UsersIcon,
  UserIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  Loader2Icon,
  SparklesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  StoreIcon,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  staggerContainerVariants,
  staggerItemVariants,
  scaleInVariants,
} from '@/lib/design-system/variants/motion-variants'

// ─── Types ───────────────────────────────────────────────────────────────────

type OnboardingUser = {
  userId: string
  name: string
  email: string
  onboardingType: string | null
  onboardingStatus: string
  emailVerifiedAt: string | null
}

type TenantItem = { tenantId: string; nombre: string; slug: string | null }

type OnboardingStep = 'type' | 'tenant' | 'approval' | 'company'

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 'type' as const, label: 'Tipo de Usuario', icon: UserIcon },
  { id: 'tenant' as const, label: 'Organización', icon: Building2Icon },
  { id: 'confirmation' as const, label: 'Confirmación', icon: CheckCircle2Icon },
]

type StepIndicatorProps = {
  currentStep: number
  reduceMotion: boolean
}

function StepIndicator({ currentStep, reduceMotion }: StepIndicatorProps) {
  return (
    <nav aria-label="Progreso del onboarding" className="mb-8">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          const Icon = step.icon

          return (
            <li key={step.id} className="flex items-center gap-2 sm:gap-4">
              <motion.div
                className="flex items-center gap-2"
                animate={reduceMotion ? {} : { opacity: 1 }}
              >
                {/* Step circle */}
                <motion.div
                  initial={reduceMotion ? undefined : { scale: 0.8 }}
                  animate={{
                    scale: 1,
                    backgroundColor: isCompleted
                      ? 'var(--primary)'
                      : isActive
                        ? 'var(--primary)'
                        : 'var(--muted)',
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                  }}
                  className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-shadow',
                    isActive && 'shadow-lg shadow-primary/25',
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted text-muted-foreground',
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <motion.svg
                      key={`check-${index}`}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </motion.svg>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </motion.div>

                {/* Label — hidden on mobile, visible sm+ */}
                <span
                  className={cn(
                    'hidden text-sm font-medium sm:inline',
                    isActive
                      ? 'text-foreground'
                      : isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </motion.div>

              {/* Connector */}
              {index < STEPS.length - 1 && (
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isCompleted
                      ? 'var(--primary)'
                      : 'var(--border)',
                  }}
                  transition={{ duration: 0.3 }}
                  className="hidden h-0.5 w-8 rounded-full bg-border sm:block md:w-12"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── Logo Sparkle Icon ────────────────────────────────────────────────────────

type LogoIconProps = {
  icon: React.ElementType
  className?: string
  reduceMotion: boolean
}

function LogoIcon({ icon: Icon, className, reduceMotion }: LogoIconProps) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 170,
        damping: 20,
      }}
      className={cn('relative mx-auto mb-6', className)}
    >
      <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-primary to-purple-600 blur-lg opacity-60" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-600 shadow-lg">
        <Icon className="h-8 w-8 text-white" />
      </div>
      {!reduceMotion && (
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute -right-1 -top-1"
        >
          <SparklesIcon className="h-5 w-5 text-yellow-400" />
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Type Selection Card ─────────────────────────────────────────────────────

type TypeCardProps = {
  icon: React.ElementType
  title: string
  description: string
  features: string[]
  onClick: () => void
  reduceMotion: boolean
}

function TypeCard({ icon: Icon, title, description, features, onClick, reduceMotion }: TypeCardProps) {
  return (
    <motion.button
      variants={staggerItemVariants}
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -6, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="group relative flex flex-col items-start rounded-2xl border-2 border-border/50 bg-card/60 p-6 text-left shadow-sm backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="relative mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="relative mb-4 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <ul className="relative space-y-1.5">
        {features.map((feat) => (
          <li key={feat} className="flex items-start gap-2 text-xs text-muted-foreground/80">
            <CheckCircle2Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
            {feat}
          </li>
        ))}
      </ul>

      {/* Arrow indicator */}
      <motion.div
        initial={false}
        animate={reduceMotion ? { x: 0 } : { x: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative ml-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <ArrowRightIcon className="h-4 w-4" />
      </motion.div>
    </motion.button>
  )
}

// ─── Tenant Card ─────────────────────────────────────────────────────────────

type TenantCardProps = {
  tenant: TenantItem
  onClick: () => void
  reduceMotion: boolean
}

function TenantCard({ tenant, onClick, reduceMotion }: TenantCardProps) {
  return (
    <motion.button
      variants={staggerItemVariants}
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="group relative flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <StoreIcon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{tenant.nombre}</div>
        <div className="truncate text-xs text-muted-foreground">
          {tenant.slug || tenant.tenantId}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -4 }}
        whileHover={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100"
      >
        <ArrowRightIcon className="h-4 w-4" />
      </motion.div>
    </motion.button>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function OnboardingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        />
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-muted-foreground"
        >
          Preparando tu configuración...
        </motion.p>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

/**
 * @description Pantalla de onboarding post-registro con diseño glassmorphism,
 *              step wizard animado y selección de tipo de usuario / tenant.
 *              Sigue el patrón visual de login/register (Bungee industrial).
 * @returns {JSX.Element} Flujo de onboarding multi-step con animaciones.
 */
export default function OnboardingPage(): React.ReactNode {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const shouldReduce = !!reduceMotion

  const [user, setUser] = useState<OnboardingUser | null>(null)
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onboardingToken =
    typeof window !== 'undefined' ? sessionStorage.getItem('onboardingToken') : null

  // ─── Fetch initial data ────────────────────────────────────────────────

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (!onboardingToken) {
        router.replace('/register')
        return
      }

      try {
        const response = await fetch('/api/auth/onboarding/me', {
          headers: {
            Authorization: `Bearer ${onboardingToken}`,
            'x-request-id':
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : '',
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
      } catch (err) {
        setError('Error de conexión. Intentalo de nuevo.')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [onboardingToken, router])

  // ─── Derived state ─────────────────────────────────────────────────────

  const currentStep = useMemo<OnboardingStep>(() => {
    if (!user) return 'type'
    if (user.onboardingStatus === 'awaiting_manager_approval') return 'approval'
    if (user.onboardingType === 'company') return 'company'
    if (user.onboardingType === 'worker') return 'tenant'
    return 'type'
  }, [user])

  const stepIndex = useMemo(() => {
    if (currentStep === 'type') return 0
    if (currentStep === 'tenant') return 1
    return 2
  }, [currentStep])

  const canSelectTenant = useMemo(
    () => user?.onboardingType === 'worker' && user?.onboardingStatus !== 'awaiting_manager_approval',
    [user],
  )

  // ─── Actions ───────────────────────────────────────────────────────────

  const chooseType = useCallback(
    async (userType: 'worker' | 'company'): Promise<void> => {
      if (!onboardingToken) return
      setSubmitting(userType)
      setError(null)

      try {
        const response = await fetch('/api/auth/onboarding/type', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${onboardingToken}`,
            'x-request-id':
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : '',
          },
          body: JSON.stringify({ userType }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'No se pudo guardar el tipo de usuario')
          return
        }

        setUser((current) =>
          current
            ? {
                ...current,
                onboardingType: userType,
                onboardingStatus: data.onboardingStatus,
              }
            : current,
        )
      } catch {
        setError('Error de conexión. Intentalo de nuevo.')
      } finally {
        setSubmitting(null)
      }
    },
    [onboardingToken],
  )

  const chooseTenant = useCallback(
    async (tenantId: string): Promise<void> => {
      if (!onboardingToken) return
      setSubmitting(tenantId)
      setError(null)

      try {
        const response = await fetch('/api/auth/onboarding/tenant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${onboardingToken}`,
            'x-request-id':
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : '',
          },
          body: JSON.stringify({ tenantId }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'No se pudo asociar la empresa')
          return
        }

        setUser((current) =>
          current
            ? {
                ...current,
                onboardingStatus: 'awaiting_manager_approval',
              }
            : current,
        )
      } catch {
        setError('Error de conexión. Intentalo de nuevo.')
      } finally {
        setSubmitting(null)
      }
    },
    [onboardingToken],
  )

  // ─── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return <OnboardingSkeleton />
  }

  if (!user && !error) {
    return null
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-slate-50 via-white to-slate-100 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Animated Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={shouldReduce ? {} : { y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
        <motion.div
          animate={shouldReduce ? {} : { y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -right-40 top-1/3 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl"
        />
        <motion.div
          animate={shouldReduce ? {} : { y: [0, -15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl"
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Back link */}
      <motion.a
        href="/"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute left-4 top-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Volver al inicio
      </motion.a>

      {/* Error banner (outside card) */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="global-error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-4 z-50 w-full max-w-md px-4"
          >
            <Alert
              variant="destructive"
              className="border-red-300 bg-red-50/90 shadow-lg backdrop-blur-sm dark:bg-red-900/30"
            >
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative w-full max-w-lg"
      >
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-primary/30 via-purple-500/30 to-primary/30 opacity-60 blur-xl" />

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-slate-700/30 dark:bg-slate-900/80">
          {/* Inner content */}
          <div className="px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
            {/* Step Indicator */}
            {user && <StepIndicator currentStep={stepIndex} reduceMotion={shouldReduce} />}

            {/* ═══════ STEP 1: Choose Type ═══════ */}
            {currentStep === 'type' && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="step-type"
                  initial={{ opacity: 0, x: shouldReduce ? 0 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: shouldReduce ? 0 : -20 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <LogoIcon icon={UserIcon} reduceMotion={shouldReduce} />

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-8 text-center"
                  >
                    <h1 className="mb-2 bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-slate-300">
                      Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                    </h1>
                    <p className="text-muted-foreground">
                      Contanos cómo vas a usar FinanceMDM para personalizar tu experiencia.
                    </p>
                  </motion.div>

                  {/* Type Selection Cards */}
                  <motion.div
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <TypeCard
                      icon={BriefcaseIcon}
                      title="Trabajador"
                      description="Accedé a una empresa existente como empleado, dependiente o económico."
                      features={[
                        'Gestión de inventario y ventas',
                        'Reportes asignados por tu manager',
                        'Acceso a puntos de venta',
                      ]}
                      onClick={() => void chooseType('worker')}
                      reduceMotion={shouldReduce}
                    />
                    <TypeCard
                      icon={Building2Icon}
                      title="Empresa"
                      description="Configurá tu propia organización como manager o administrador."
                      features={[
                        'Control total de usuarios y roles',
                        'Configuración de catálogo',
                        'Reportes financieros avanzados',
                      ]}
                      onClick={() => void chooseType('company')}
                      reduceMotion={shouldReduce}
                    />
                  </motion.div>

                  {/* Submitting overlay */}
                  <AnimatePresence>
                    {submitting && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Guardando selección...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            )}

            {/* ═══════ STEP 2: Select Tenant ═══════ */}
            {currentStep === 'tenant' && canSelectTenant && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="step-tenant"
                  initial={{ opacity: 0, x: shouldReduce ? 0 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: shouldReduce ? 0 : -20 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <LogoIcon icon={Building2Icon} reduceMotion={shouldReduce} />

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-6 text-center"
                  >
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Elegí tu organización</h2>
                    <p className="text-sm text-muted-foreground">
                      Seleccioná la empresa a la que querés asociarte. Si necesitás acceso a más de una,
                      comunicate con el administrador.
                    </p>
                  </motion.div>

                  {tenants.length > 0 ? (
                    <motion.div
                      variants={staggerContainerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-3"
                    >
                      {tenants.map((tenant) => (
                        <TenantCard
                          key={tenant.tenantId}
                          tenant={tenant}
                          onClick={() => void chooseTenant(tenant.tenantId)}
                          reduceMotion={shouldReduce}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={scaleInVariants}
                      initial="hidden"
                      animate="visible"
                      className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"
                    >
                      <Building2Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        No hay empresas registradas todavía.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        Comunicate con el administrador para que te agregue.
                      </p>
                    </motion.div>
                  )}

                  {/* Submitting overlay */}
                  <AnimatePresence>
                    {submitting && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Enviando solicitud...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            )}

            {/* ═══════ STEP 3: Awaiting Approval ═══════ */}
            {currentStep === 'approval' && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="step-approval"
                  initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: shouldReduce ? 1 : 0.95 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center"
                >
                  {/* Success checkmark animation */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                      delay: 0.2,
                    }}
                    className="relative mx-auto mb-6"
                  >
                    <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl" />
                    <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                      <motion.svg
                        className="h-10 w-10 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <motion.path
                          d="M20 6L9 17l-5-5"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
                        />
                      </motion.svg>
                    </div>
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="mb-2 text-2xl font-bold text-foreground"
                  >
                    Solicitud enviada
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="mb-6 text-sm leading-relaxed text-muted-foreground"
                  >
                    Tu acceso quedó en espera de aprobación por el manager de la empresa seleccionada.
                    Te notificaremos cuando esté listo.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                    className="rounded-xl bg-muted/50 p-4"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground">Esperando aprobación del manager...</span>
                    </div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.4 }}
                    className="mt-6 text-xs text-muted-foreground/60"
                  >
                    Si tenes dudas, comunicate con soporte.
                  </motion.p>
                </motion.div>
              </AnimatePresence>
            )}

            {/* ═══════ STEP 3 alt: Company account ═══════ */}
            {currentStep === 'company' && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="step-company"
                  initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: shouldReduce ? 1 : 0.95 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                      delay: 0.2,
                    }}
                    className="relative mx-auto mb-6"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-primary/30 via-purple-500/30 to-primary/30 blur-xl" />
                    <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-600 shadow-lg">
                      <Building2Icon className="h-10 w-10 text-white" />
                    </div>
                    {!shouldReduce && (
                      <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{
                          rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                          scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                        }}
                        className="absolute -right-1 -top-1"
                      >
                        <SparklesIcon className="h-5 w-5 text-yellow-400" />
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="mb-2 text-2xl font-bold text-foreground"
                  >
                    Empresa en espera
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="mb-6 text-sm leading-relaxed text-muted-foreground"
                  >
                    Comunicate con el administrador global para garantizar el acceso y comenzar a
                    configurar tu empresa.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                    className="rounded-xl bg-muted/50 p-4"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <UsersIcon className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Contactá al admin global para activar tu organización
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Bottom decorative line */}
          <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        </div>
      </motion.div>
    </div>
  )
}
