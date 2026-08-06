'use client'

import type React from 'react'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRoundIcon, AlertCircleIcon, Loader2Icon, CheckCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { motion, AnimatePresence } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/hooks/use-hydration-safe-reduced-motion'
import { requestPasswordResetAction } from '@/features/auth/actions-password-reset'

const SPRING_DEFAULT = { type: 'spring' as const, stiffness: 120, damping: 20 }
const SPRING_HOVER = { type: 'spring' as const, stiffness: 300, damping: 15 }

/**
 * @description Página para solicitar un enlace de recuperación de contraseña.
 *              Retorna un mensaje genérico de éxito para no revelar si el email existe.
 * @returns {React.ReactElement} Formulario de recuperación de contraseña.
 */
export default function ForgotPasswordPage(): React.ReactElement {
	const [email, setEmail] = useState('')
	const [error, setError] = useState('')
	const [sent, setSent] = useState(false)
	const [loading, setLoading] = useState(false)
	const reduceMotion = useHydrationSafeReducedMotion()
	const [mounted, setMounted] = useState(false)
	const shouldAnimate = mounted && !reduceMotion

	useEffect(() => {
		setMounted(true)
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailPattern.test(email)) {
			setError('Ingresa un email válido.')
			return
		}

		setLoading(true)
		const result = await requestPasswordResetAction({ email })
		setLoading(false)

		if (!result.success) {
			setError(result.error.message)
			return
		}

		setSent(true)
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
						<KeyRoundIcon aria-hidden="true" className="h-7 w-7 text-[#0066cc] dark:text-[#2997ff]" />
					</motion.div>

					<motion.h1
						{...fadeUp(0.1)}
						className="mb-2 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white"
					>
						¿Olvidaste tu contraseña?
					</motion.h1>
					<motion.p
						{...fadeUp(0.15)}
						className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[#7a7a7a] dark:text-[#cccccc]"
					>
						Ingresa tu correo y te enviaremos un enlace para restablecerla
					</motion.p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="px-8 pb-8">
					<div className="space-y-5">
						<AnimatePresence>
							{sent && (
								<motion.div
									role="status"
									aria-live="polite"
									initial={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<Alert className="border-green-300 bg-green-50/80 dark:bg-green-900/20">
										<CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-green-600" />
										<AlertDescription className="text-green-800 dark:text-green-200">
											Si el correo está registrado, recibirás un enlace para restablecer tu
											contraseña.
										</AlertDescription>
									</Alert>
								</motion.div>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{error && (
								<motion.div
									role="alert"
									aria-live="assertive"
									initial={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={shouldAnimate ? { opacity: 0, height: 0 } : { opacity: 1 }}
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<Alert variant="destructive" className="border-red-300 bg-red-50/80 dark:bg-red-900/20">
										<AlertCircleIcon aria-hidden="true" className="h-4 w-4" />
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
									name="email"
									type="email"
									autoComplete="email"
									placeholder="tu@email.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									disabled={loading}
									spellCheck={false}
									className="h-11 rounded-lg border-[#e0e0e0] bg-white text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
								/>
							</motion.div>
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
											<Loader2Icon aria-hidden="true" className="h-5 w-5 animate-spin" />
											Enviando…
										</span>
									) : (
										'Enviar enlace de recuperación'
									)}
								</Button>
							</motion.div>
						</motion.div>

						<motion.p {...fadeUp(0.35)} className="text-center text-sm text-[#7a7a7a] dark:text-[#cccccc]">
							<Link
								href="/login"
								className="font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
							>
								Volver a iniciar sesión
							</Link>
						</motion.p>
					</div>
				</form>
			</motion.div>
		</AuthLayout>
	)
}
