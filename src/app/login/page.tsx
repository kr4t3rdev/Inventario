'use client'

import type React from 'react'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EyeIcon, EyeOffIcon, LogInIcon, AlertCircleIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import Link from 'next/link'
import { LazyMotion, m as motion, AnimatePresence } from 'framer-motion'
import { AuthLayout } from '@/components/auth/auth-layout'

interface LoginFormBodyProps {
  onSubmit: (email: string, password: string) => Promise<void>
  loading: boolean
  error: string
}

/**
 * @description Formulario de login con estado local de campos para aislar re-renders
 * por keystroke del wrapper animado externo.
 * @param {LoginFormBodyProps} props
 * @returns {React.ReactElement}
 */
function LoginFormBody({ onSubmit, loading, error }: LoginFormBodyProps): React.ReactElement {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(email, password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="px-8 pb-8 space-y-5"
      >
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant="destructive" className="border-red-300 bg-red-50/80 dark:bg-red-900/20">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          className="space-y-2"
        >
          <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Correo electrónico
          </Label>
          <motion.div whileFocus={{ scale: 1.02 }}>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
          </motion.div>
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña
            </Label>
          </div>
          <motion.div whileFocus={{ scale: 1.02 }} className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 pr-12"
            />
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <motion.div
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogInIcon className="h-5 w-5" />
                  Iniciar Sesión
                </span>
              )}
            </Button>
          </motion.div>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          className="relative py-2"
        >
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-4 bg-white/80 dark:bg-slate-900/80 text-slate-400">
              o continúa con
            </span>
          </div>
        </motion.div>

        {/* Google Login Button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <motion.a
            href="/api/auth/google/authorize"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 gap-2 shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </motion.a>
        </motion.div>

        {/* Register Link */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          className="text-center"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ¿No tienes una cuenta?{' '}
            <Link
              href="/register"
              className="font-semibold text-primary hover:text-primary/80 transition-colors duration-200 relative group"
            >
              Regístrate aquí
              <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </form>
  )
}

/**
 * @description Página de login con animaciones de entrada y tarjeta glassmorphism
 * @returns {React.ReactElement}
 */
export default function LoginPage(): React.ReactElement {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (email: string, password: string) => {
    setError('')
    setLoading(true)

    const success = await login(email, password)

    if (!success) {
      setError('Credenciales inválidas. Por favor, verifica tu email y contraseña.')
    }

    setLoading(false)
  }

  return (
    <AuthLayout>
      {/* Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative"
      >
        {/* Card Glow Effect */}
        <div className="absolute -inset-1 bg-linear-to-r from-primary/30 via-purple-500/30 to-primary/30 rounded-3xl blur-xl opacity-60 animate-pulse" />
        
        {/* Main Card */}
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/30 overflow-hidden">
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="px-8 pt-8 pb-6 text-center"
          >
            {/* Logo Icon */}
            <motion.div 
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 170,
                damping: 20,
                delay: 0.3
              }}
              className="relative mx-auto mb-6"
            >
              <div className="absolute inset-0 bg-linear-to-r from-primary to-purple-600 rounded-2xl blur-lg opacity-60" />
              <div className="relative w-16 h-16 bg-linear-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <LogInIcon className="h-8 w-8 text-white" />
              </div>
              {/* Sparkle effect */}
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                }}
                className="absolute -top-1 -right-1"
              >
                <SparklesIcon className="h-5 w-5 text-yellow-400" />
              </motion.div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
              className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-2"
            >
              Bienvenido de nuevo
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
              className="text-slate-500 dark:text-slate-400"
            >
              Ingresa tus credenciales para continuar
            </motion.p>
          </motion.div>

          {/* Form Section */}
          <LoginFormBody onSubmit={handleSubmit} loading={loading} error={error} />

          {/* Bottom decorative line */}
          <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        </div>
      </motion.div>
    </AuthLayout>
  )
}
