'use client'

import type React from 'react'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LockIcon, AlertCircleIcon, Loader2Icon, CheckCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { motion, AnimatePresence } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/hooks/use-hydration-safe-reduced-motion'
import { resetPasswordAction } from '@/features/auth/actions-password-reset'

const SPRING_DEFAULT = { type: 'spring' as const, stiffness: 120, damping: 20 }
const SPRING_HOVER = { type: 'spring' as const, stiffness: 300, damping: 15 }

/**
 * @description Contenido de la página para establecer una nueva contraseña con token.
 * @returns {React.ReactElement} Formulario de nueva contraseña.
 */
function ResetPasswordContent(): React.ReactElement {
	const searchParams = useSearchParams()
	const tokenFromUrl = searchParams.get('token') || ''

	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [loading, setLoading] = useState(false)
	const reduceMotion = useHydrationSafeReducedMotion()
	const [mounted, setMounted] = useState(false)
	const shouldAnimate = mounted && !reduceMotion

	useEffect(() => {
		setMounted(true)
	}, [])

	const validateToken = useCallback((): boolean => {
		if (tokenFromUrl) return true
		setError('El enlace no es válido. Solicita uno nuevo.')
		return false
	}, [tokenFromUrl])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		if (!validateToken()) return

		if (password.length < 6) {
			setError('La contraseña debe tener al menos 6 caracteres')
			return
		}

		if (password !== confirmPassword) {
			setError('Las contraseñas no coinciden')
			return
		}

		setLoading(true)
		const result = await resetPasswordAction({ token: tokenFromUrl, password })
		setLoading(false)

		if (!result.success) {
			setError(result.error.message)
			return
		}

		setSuccess(true)
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
						<LockIcon className="h-7 w-7 text-[#0066cc] dark:text-[#2997ff]" />
					</motion.div>

					<motion.h1
						{...fadeUp(0.1)}
						className="mb-2 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white"
					>
						Restablecer contraseña
					</motion.h1>
					<motion.p
						{...fadeUp(0.15)}
						className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[#7a7a7a] dark:text-[#cccccc]"
					>
						Ingresa tu nueva contraseña
					</motion.p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="px-8 pb-8">
					<div className="space-y-5">
						<AnimatePresence>
							{success && (
								<motion.div
									initial={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<Alert className="border-green-300 bg-green-50/80 dark:bg-green-900/20">
										<CheckCircleIcon className="h-4 w-4 text-green-600" />
										<AlertDescription className="text-green-800 dark:text-green-200">
											Contraseña actualizada correctamente.
										</AlertDescription>
									</Alert>
								</motion.div>
							)}
						</AnimatePresence>

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

						{!success && (
							<>
								<motion.div {...fadeUp(0.2)} className="space-y-2">
									<Label htmlFor="password" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
										Nueva contraseña
									</Label>
									<div className="relative">
										<motion.div whileFocus={shouldAnimate ? { scale: 1.01 } : {}} transition={SPRING_DEFAULT}>
											<Input
												id="password"
												type={showPassword ? 'text' : 'password'}
												placeholder="Mínimo 6 caracteres"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
												required
												disabled={loading}
												className="h-11 rounded-lg border-[#e0e0e0] bg-white pr-12 text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
											/>
										</motion.div>
										<motion.button
											type="button"
											whileHover={shouldAnimate ? { scale: 1.1 } : {}}
											whileTap={shouldAnimate ? { scale: 0.9 } : {}}
											transition={SPRING_HOVER}
											onClick={() => setShowPassword(!showPassword)}
											disabled={loading}
											aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
											className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white"
										>
											{showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
										</motion.button>
									</div>
								</motion.div>

								<motion.div {...fadeUp(0.25)} className="space-y-2">
									<Label htmlFor="confirmPassword" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
										Confirmar contraseña
									</Label>
									<div className="relative">
										<motion.div whileFocus={shouldAnimate ? { scale: 1.01 } : {}} transition={SPRING_DEFAULT}>
											<Input
												id="confirmPassword"
												type={showConfirmPassword ? 'text' : 'password'}
												placeholder="Repite tu contraseña"
												value={confirmPassword}
												onChange={(e) => setConfirmPassword(e.target.value)}
												required
												disabled={loading}
												className="h-11 rounded-lg border-[#e0e0e0] bg-white pr-12 text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
											/>
										</motion.div>
										<motion.button
											type="button"
											whileHover={shouldAnimate ? { scale: 1.1 } : {}}
											whileTap={shouldAnimate ? { scale: 0.9 } : {}}
											transition={SPRING_HOVER}
											onClick={() => setShowConfirmPassword(!showConfirmPassword)}
											disabled={loading}
											aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
											className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white"
										>
											{showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
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
													Guardando...
												</span>
											) : (
												'Guardar nueva contraseña'
											)}
										</Button>
									</motion.div>
								</motion.div>
							</>
						)}

						{success && (
							<motion.div {...fadeUp(0.35)}>
								<Link
									href="/login"
									className="flex h-11 w-full items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-[17px] font-normal leading-[1.47] tracking-[-0.022em] text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:hover:bg-white/5"
								>
									Iniciar sesión
								</Link>
							</motion.div>
						)}

						<motion.p {...fadeUp(0.35)} className="text-center text-sm text-[#7a7a7a] dark:text-[#cccccc]">
							<Link
								href="/forgot-password"
								className="font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
							>
								Solicitar un nuevo enlace
							</Link>
						</motion.p>
					</div>
				</form>
			</motion.div>
		</AuthLayout>
	)
}

/**
 * @description Pantalla para restablecer la contraseña, wrappeada en Suspense para useSearchParams.
 * @returns {JSX.Element} Vista de restablecimiento de contraseña.
 */
export default function ResetPasswordPage(): React.ReactElement {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-6 dark:bg-[#1d1d1f]">
					<div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0066cc] border-t-transparent" />
				</div>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	)
}
