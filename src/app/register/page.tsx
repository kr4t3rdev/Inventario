'use client'

import type React from 'react'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EyeIcon, EyeOffIcon, UserPlusIcon, AlertCircleIcon, Loader2Icon, SparklesIcon, CheckCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const result = await register(name, email, password)

    if (result.success) {
      setSuccessMessage(result.message || 'Cuenta creada exitosamente')
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } else {
      setError(result.message || 'Error al crear la cuenta. Es posible que el email ya esté en uso.')
    }

    setLoading(false)
  }

  return (
    <AuthLayout>
      {/* Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' as const }}
        className="relative"
      >
        {/* Card Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/30 via-primary/30 to-purple-500/30 rounded-3xl blur-xl opacity-60 animate-pulse" />
        
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
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.3
              }}
              className="relative mx-auto mb-6"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-primary rounded-2xl blur-lg opacity-60" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-purple-600 to-primary rounded-2xl flex items-center justify-center shadow-lg">
                <UserPlusIcon className="h-8 w-8 text-white" />
              </div>
              {/* Sparkle effect */}
              <motion.div
                animate={{ 
                  rotate: -360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                }}
                className="absolute -top-1 -left-1"
              >
                <SparklesIcon className="h-5 w-5 text-yellow-400" />
              </motion.div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' as const }}
              className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-2"
            >
              Crear Cuenta
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' as const }}
              className="text-slate-500 dark:text-slate-400"
            >
              Completa los datos para comenzar
            </motion.p>
          </motion.div>

          {/* Form Section */}
          <form onSubmit={handleSubmit}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="px-8 pb-8 space-y-5"
            >
              {/* Success Alert */}
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <Alert className="border-green-300 bg-green-50/80 dark:bg-green-900/20">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Error Alert */}
              {error && (
                <motion.div
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

              {/* Name Field */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' as const }}
                className="space-y-2"
              >
                <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre Completo
                </Label>
                <motion.div whileFocus={{ scale: 1.02 }}>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  />
                </motion.div>
              </motion.div>

              {/* Email Field */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' as const }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5, ease: 'easeOut' as const }}
                className="space-y-2"
              >
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Contraseña
                </Label>
                <motion.div whileFocus={{ scale: 1.02 }} className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
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

              {/* Confirm Password Field */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5, ease: 'easeOut' as const }}
                className="space-y-2"
              >
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirmar Contraseña
                </Label>
                <motion.div whileFocus={{ scale: 1.02 }} className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 pr-12"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
                  >
                    {showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </motion.button>
                </motion.div>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5, ease: 'easeOut' as const }}
              >
                <motion.div
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-primary hover:from-purple-600/90 hover:to-primary/90 text-white font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2Icon className="h-5 w-5 animate-spin" />
                        Creando cuenta...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlusIcon className="h-5 w-5" />
                        Crear Cuenta
                      </span>
                    )}
                  </Button>
                </motion.div>
              </motion.div>

              {/* Divider */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5, ease: 'easeOut' as const }}
                className="relative py-2"
              >
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white/80 dark:bg-slate-900/80 text-slate-400">
                    o si ya tienes cuenta
                  </span>
                </div>
              </motion.div>

              {/* Login Link */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5, ease: 'easeOut' as const }}
                className="text-center"
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ¿Ya tienes una cuenta?{' '}
                  <Link 
                    href="/login" 
                    className="font-semibold text-primary hover:text-primary/80 transition-colors duration-200 relative group"
                  >
                    Inicia sesión aquí
                    <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
                  </Link>
                </p>
              </motion.div>
            </motion.div>
          </form>

          {/* Bottom decorative line */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-primary to-purple-500" />
        </div>
      </motion.div>
    </AuthLayout>
  )
}
