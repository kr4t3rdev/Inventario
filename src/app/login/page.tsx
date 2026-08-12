'use client'

import type React from 'react'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EyeIcon, EyeOffIcon, LogInIcon, AlertCircleIcon, Loader2Icon } from 'lucide-react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { motion, AnimatePresence } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/hooks/use-hydration-safe-reduced-motion'

const SPRING_DEFAULT = { type: 'spring' as const, stiffness: 120, damping: 20 }
const SPRING_HOVER = { type: 'spring' as const, stiffness: 300, damping: 15 }

/**
 * @description Página de login con animaciones spring (mismo patrón que el homepage).
 * @returns {React.ReactElement}
 */
export default function LoginPage(): React.ReactElement {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const { login } = useAuth()
	const reduceMotion = useHydrationSafeReducedMotion()
	const [mounted, setMounted] = useState(false)
	const shouldAnimate = mounted && !reduceMotion

	useEffect(() => {
		setMounted(true)
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		const success = await login(email, password)

		if (!success) {
			setError('Credenciales inválidas. Por favor, verifica tu email y contraseña.')
		}

		setLoading(false)
	}

	const fadeUp = (delay: number) =>
		!shouldAnimate
			? {}
			: {
					initial: { opacity: 0, y: 30 },
					animate: { opacity: 1, y: 0 },
					transition: { ...SPRING_DEFAULT, delay },
				}

	return (
		<AuthLayout>
			<motion.div
				initial={shouldAnimate ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
				animate={{ opacity: 1, y: 0 }}
				transition={SPRING_DEFAULT}
				className="overflow-hidden rounded-[18px] border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#272729]"
			>
				{/* Header */}
				<div className="px-8 pb-6 pt-10 text-center">
					<motion.div
						initial={shouldAnimate ? { scale: 0 } : { scale: 1 }}
						animate={{ scale: 1 }}
						transition={{ type: 'spring' as const, stiffness: 200, damping: 18, delay: 0.05 }}
						className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066cc]/10"
					>
						<LogInIcon className="h-7 w-7 text-[#0066cc]" />
					</motion.div>

					<motion.h1
						{...fadeUp(0.1)}
						className="mb-2 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white"
					>
						Iniciar sesión
					</motion.h1>
					<motion.p
						{...fadeUp(0.15)}
						className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[#7a7a7a] dark:text-[#cccccc]"
					>
						Ingresa tus credenciales para continuar
					</motion.p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="px-8 pb-8">
					<div className="space-y-5">
						<AnimatePresence>
							{error && (
								<motion.div
									initial={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<Alert variant="destructive" className="border-red-300 bg-red-50/80 dark:bg-red-900/20">
										<AlertCircleIcon className="h-4 w-4" />
										<AlertDescription>{error}</AlertDescription>
									</Alert>
								</motion.div>
							)}
						</AnimatePresence>

						<motion.div {...fadeUp(0.2)} className="space-y-2">
							<Label htmlFor="email" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
								Correo electrónico
							</Label>
							<motion.div whileFocus={shouldAnimate ? { scale: 1.01 } : {}} transition={SPRING_DEFAULT}>
								<Input
									id="email"
									type="email"
									placeholder="tu@email.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									disabled={loading}
									className="h-11 rounded-lg border-[#e0e0e0] bg-white text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
								/>
							</motion.div>
						</motion.div>

						<motion.div {...fadeUp(0.25)} className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="password" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
									Contraseña
								</Label>
								<Link
									href="/forgot-password"
									className="text-sm font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
								>
									¿Olvidaste tu contraseña?
								</Link>
							</div>
							<div className="relative">
								<motion.div whileFocus={shouldAnimate ? { scale: 1.01 } : {}} transition={SPRING_DEFAULT}>
									<Input
										id="password"
										type={showPassword ? 'text' : 'password'}
										placeholder="Tu contraseña"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										disabled={loading}
										className="h-11 rounded-lg border-[#e0e0e0] bg-white pr-12 text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
									/>
								</motion.div>
								<motion.button
									type="button"
									aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
									whileHover={shouldAnimate ? { scale: 1.1 } : {}}
									whileTap={shouldAnimate ? { scale: 0.9 } : {}}
									transition={SPRING_HOVER}
									onClick={() => setShowPassword(!showPassword)}
									disabled={loading}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white"
								>
									{showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								</motion.button>
							</div>
						</motion.div>

						<motion.div {...fadeUp(0.3)}>
							<motion.div
								whileHover={shouldAnimate && !loading ? { scale: 1.02 } : {}}
								whileTap={shouldAnimate && !loading ? { scale: 0.97 } : {}}
								transition={SPRING_HOVER}
							>
								<Button
									type="submit"
									disabled={loading}
									className="h-11 w-full rounded-full bg-[#0066cc] px-[22px] text-[17px] font-normal leading-[1.47] tracking-[-0.022em] text-white hover:bg-[#0071e3] dark:bg-[#2997ff] dark:text-[#1d1d1f] dark:hover:bg-[#47a8ff]"
								>
									{loading ? (
										<span className="flex items-center gap-2">
											<Loader2Icon className="h-5 w-5 animate-spin" />
											Iniciando sesión...
										</span>
									) : (
										'Iniciar sesión'
									)}
								</Button>
							</motion.div>
						</motion.div>

						<motion.div {...fadeUp(0.35)} className="relative py-1">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-[#e0e0e0] dark:border-white/10" />
							</div>
							<div className="relative flex justify-center text-xs">
								<span className="bg-white px-4 text-[#7a7a7a] dark:bg-[#272729] dark:text-[#cccccc]">
									o continúa con
								</span>
							</div>
						</motion.div>

						<motion.div {...fadeUp(0.4)}>
							<motion.a
								href="/api/auth/google/authorize"
								whileHover={shouldAnimate ? { scale: 1.02 } : {}}
								whileTap={shouldAnimate ? { scale: 0.97 } : {}}
								transition={SPRING_HOVER}
								className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e0e0e0] bg-white text-[17px] font-normal leading-[1.47] tracking-[-0.022em] text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:hover:bg-white/5"
							>
								<svg className="h-5 w-5" viewBox="0 0 24 24">
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

						<motion.p {...fadeUp(0.45)} className="text-center text-sm text-[#7a7a7a] dark:text-[#cccccc]">
							¿No tienes una cuenta?{' '}
							<Link
								href="/register"
								className="font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
							>
								Regístrate aquí
							</Link>
						</motion.p>
					</div>
				</form>
			</motion.div>
		</AuthLayout>
	)
}
