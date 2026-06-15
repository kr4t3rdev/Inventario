'use client'

import type React from 'react'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EyeIcon, EyeOffIcon, UserPlusIcon, AlertCircleIcon, Loader2Icon, CheckCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AuthLayout } from '@/components/auth/auth-layout'

const SPRING_DEFAULT = { type: 'spring' as const, stiffness: 120, damping: 20 }
const SPRING_HOVER = { type: 'spring' as const, stiffness: 300, damping: 15 }

/**
 * @description Página de registro con animaciones spring (mismo patrón que el homepage).
 * @returns {React.ReactElement}
 */
export default function RegisterPage(): React.ReactElement {
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
	const reduceMotion = !!useReducedMotion()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

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
		} else {
			setError(result.message || 'Error al crear la cuenta. Es posible que el email ya esté en uso.')
		}

		setLoading(false)
	}

	const fadeUp = (delay: number) =>
		!mounted || reduceMotion
			? {}
			: {
					initial: { opacity: 0, y: 30 },
					animate: { opacity: 1, y: 0 },
					transition: { ...SPRING_DEFAULT, delay },
				}

	return (
		<AuthLayout>
			<motion.div
				initial={!mounted || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={SPRING_DEFAULT}
				className="overflow-hidden rounded-[18px] border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#272729]"
			>
				{/* Header */}
				<div className="px-8 pb-6 pt-10 text-center">
					<motion.div
						initial={reduceMotion ? { scale: 1 } : { scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: 'spring' as const, stiffness: 200, damping: 18, delay: 0.05 }}
						className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066cc]/10"
					>
						<UserPlusIcon className="h-7 w-7 text-[#0066cc]" />
					</motion.div>

					<motion.h1
						{...fadeUp(0.1)}
						className="mb-2 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white"
					>
						Crear cuenta
					</motion.h1>
					<motion.p
						{...fadeUp(0.15)}
						className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[#7a7a7a] dark:text-[#cccccc]"
					>
						Completá los datos para comenzar
					</motion.p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="px-8 pb-8">
					<div className="space-y-5">
						<AnimatePresence>
							{successMessage && (
								<motion.div
									initial={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0, scale: 0.95 }}
									animate={{ opacity: 1, height: 'auto', scale: 1 }}
									exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0, scale: 0.95 }}
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<Alert className="border-green-300 bg-green-50/80 dark:bg-green-900/20">
										<CheckCircleIcon className="h-4 w-4 text-green-600" />
										<AlertDescription className="text-green-800 dark:text-green-200">
											{successMessage}
										</AlertDescription>
									</Alert>
								</motion.div>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{error && (
								<motion.div
									initial={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
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
							<Label htmlFor="name" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
								Nombre completo
							</Label>
							<motion.div whileFocus={reduceMotion ? {} : { scale: 1.01 }} transition={SPRING_DEFAULT}>
								<Input
									id="name"
									type="text"
									placeholder="Tu nombre completo"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
									disabled={loading}
									className="h-11 rounded-lg border-[#e0e0e0] bg-white text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
								/>
							</motion.div>
						</motion.div>

						<motion.div {...fadeUp(0.25)} className="space-y-2">
							<Label htmlFor="email" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
								Correo electrónico
							</Label>
							<motion.div whileFocus={reduceMotion ? {} : { scale: 1.01 }} transition={SPRING_DEFAULT}>
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

						<motion.div {...fadeUp(0.3)} className="space-y-2">
							<Label htmlFor="password" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
								Contraseña
							</Label>
							<div className="relative">
								<motion.div whileFocus={reduceMotion ? {} : { scale: 1.01 }} transition={SPRING_DEFAULT}>
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
									whileHover={reduceMotion ? {} : { scale: 1.1 }}
									whileTap={reduceMotion ? {} : { scale: 0.9 }}
									transition={SPRING_HOVER}
									onClick={() => setShowPassword(!showPassword)}
									disabled={loading}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white"
								>
									{showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								</motion.button>
							</div>
						</motion.div>

						<motion.div {...fadeUp(0.35)} className="space-y-2">
							<Label htmlFor="confirmPassword" className="text-sm font-medium text-[#1d1d1f] dark:text-white">
								Confirmar contraseña
							</Label>
							<div className="relative">
								<motion.div whileFocus={reduceMotion ? {} : { scale: 1.01 }} transition={SPRING_DEFAULT}>
									<Input
										id="confirmPassword"
										type={showConfirmPassword ? 'text' : 'password'}
										placeholder="Repetí tu contraseña"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										required
										disabled={loading}
										className="h-11 rounded-lg border-[#e0e0e0] bg-white pr-12 text-[17px] text-[#1d1d1f] placeholder:text-[#7a7a7a] focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] dark:border-white/15 dark:bg-[#1d1d1f] dark:text-white dark:placeholder:text-[#7a7a7a] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]"
									/>
								</motion.div>
								<motion.button
									type="button"
									whileHover={reduceMotion ? {} : { scale: 1.1 }}
									whileTap={reduceMotion ? {} : { scale: 0.9 }}
									transition={SPRING_HOVER}
									onClick={() => setShowConfirmPassword(!showConfirmPassword)}
									disabled={loading}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#7a7a7a] hover:text-[#1d1d1f] dark:hover:text-white"
								>
									{showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								</motion.button>
							</div>
						</motion.div>

						<motion.div {...fadeUp(0.4)}>
							<motion.div
								whileHover={reduceMotion || loading ? {} : { scale: 1.02 }}
								whileTap={reduceMotion || loading ? {} : { scale: 0.97 }}
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
											Creando cuenta...
										</span>
									) : (
										'Crear cuenta'
									)}
								</Button>
							</motion.div>
						</motion.div>

						<motion.p {...fadeUp(0.45)} className="text-center text-sm text-[#7a7a7a] dark:text-[#cccccc]">
							¿Ya tenés una cuenta?{' '}
							<Link
								href="/login"
								className="font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
							>
								Iniciá sesión aquí
							</Link>
						</motion.p>
					</div>
				</form>
			</motion.div>
		</AuthLayout>
	)
}
