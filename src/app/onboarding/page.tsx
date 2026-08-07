"use client";

import type React from "react";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizeSalesAgentPhone } from "@/features/sales-agent/phone";
import { motion, AnimatePresence } from "framer-motion";
import {
	Building2Icon,
	UsersIcon,
	UserIcon,
	CheckCircle2Icon,
	AlertCircleIcon,
	Loader2Icon,
	ArrowLeftIcon,
	ArrowRightIcon,
	BriefcaseIcon,
	StoreIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useHydrationSafeReducedMotion } from "@/hooks/use-hydration-safe-reduced-motion";
import { cn } from "@/lib/utils";

const SPRING_DEFAULT = { type: "spring" as const, stiffness: 120, damping: 20 };
const SPRING_HOVER = { type: "spring" as const, stiffness: 300, damping: 15 };

// ─── Types ───────────────────────────────────────────────────────────────────

type OnboardingUser = {
	userId: string;
	name: string;
	email: string;
	onboardingType: string | null;
	onboardingStatus: string;
	emailVerifiedAt: string | null;
	hasActiveMembership: boolean;
};

type TenantItem = { tenantId: string; nombre: string; slug: string | null };

type OnboardingStep =
	| "type"
	| "tenant"
	| "approval"
	| "approved"
	| "company"
	| "salesAgent"
	| "completed";

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
	{ id: "type" as const, label: "Tipo de Usuario", icon: UserIcon },
	{ id: "tenant" as const, label: "Organización", icon: Building2Icon },
	{
		id: "confirmation" as const,
		label: "Confirmación",
		icon: CheckCircle2Icon,
	},
];

type StepIndicatorProps = {
	currentStep: number;
};

function StepIndicator({ currentStep }: StepIndicatorProps) {
	return (
		<nav aria-label="Progreso del onboarding" className="mb-8">
			<ol className="flex items-center justify-center gap-2 sm:gap-4">
				{STEPS.map((step, index) => {
					const isActive = index === currentStep;
					const isCompleted = index < currentStep;
					const Icon = step.icon;

					return (
						<li key={step.id} className="flex items-center gap-2 sm:gap-4">
							<div className="flex items-center gap-2">
								{/* Step circle */}
								<div
									className={cn(
										"flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm",
										isActive && "border-[#0066cc] bg-[#0066cc] text-white shadow-sm",
										isCompleted && "border-[#0066cc] bg-[#0066cc] text-white",
										!isActive &&
											!isCompleted &&
											"border-[#e0e0e0] text-[#7a7a7a] dark:border-white/15 dark:text-[#cccccc]",
									)}
									aria-current={isActive ? "step" : undefined}
								>
									{isCompleted ? (
										<svg
											className="h-4 w-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="3"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M20 6L9 17l-5-5" />
										</svg>
									) : (
										<Icon className="h-3.5 w-3.5" />
									)}
								</div>

								<span
									className={cn(
										"hidden text-sm font-medium sm:inline",
										isActive || isCompleted
											? "text-[#1d1d1f] dark:text-white"
											: "text-[#7a7a7a] dark:text-[#cccccc]",
									)}
								>
									{step.label}
								</span>
							</div>

							{/* Connector */}
							{index < STEPS.length - 1 && (
								<div
									className={cn(
										"hidden h-0.5 w-8 rounded-full sm:block md:w-12",
										isCompleted
											? "bg-[#0066cc]"
											: "bg-[#e0e0e0] dark:bg-white/10",
									)}
								/>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

// ─── Logo Icon ─────────────────────────────────────────────────────────────

type LogoIconProps = {
	icon: React.ElementType;
	className?: string;
};

function LogoIcon({ icon: Icon, className }: LogoIconProps) {
	return (
		<div className={cn("relative mx-auto mb-6", className)}>
			<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066cc]/10">
				<Icon className="h-7 w-7 text-[#0066cc]" />
			</div>
		</div>
	);
}

// ─── Type Selection Card ─────────────────────────────────────────────────────

type TypeCardProps = {
	icon: React.ElementType;
	title: string;
	description: string;
	features: string[];
	onClick: () => void;
	shouldAnimate: boolean;
};

export function TypeCard({
	icon: Icon,
	title,
	description,
	features,
	onClick,
	shouldAnimate,
}: TypeCardProps) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			whileHover={
				shouldAnimate
					? { y: -6, scale: 1.02, transition: { type: "spring" as const, stiffness: 200, damping: 12 } }
					: undefined
			}
			whileTap={shouldAnimate ? { scale: 0.97 } : undefined}
			transition={SPRING_DEFAULT}
			className="group flex flex-col items-start rounded-[18px] border border-[#e0e0e0] bg-white p-6 text-left shadow-sm hover:border-[#0066cc]/40 hover:bg-[#f5f5f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] dark:border-white/10 dark:bg-[#1d1d1f] dark:hover:border-[#2997ff]/40 dark:hover:bg-white/5"
		>
			<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0066cc]/10 text-[#0066cc]">
				<Icon className="h-5 w-5" />
			</div>

			<h3 className="mb-1.5 text-[17px] font-semibold leading-[1.24] tracking-[-0.022em] text-[#1d1d1f] dark:text-white">
				{title}
			</h3>
			<p className="mb-4 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
				{description}
			</p>

			<ul className="space-y-1.5">
				{features.map((feat) => (
					<li
						key={feat}
						className="flex items-start gap-2 text-xs text-[#7a7a7a]/80 dark:text-[#cccccc]/80"
					>
						<CheckCircle2Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0066cc]/60 dark:text-[#2997ff]/60" />
						{feat}
					</li>
				))}
			</ul>

			<div className="ml-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
				<ArrowRightIcon className="h-4 w-4" />
			</div>
		</motion.button>
	);
}

// ─── Tenant Card ─────────────────────────────────────────────────────────────

type TenantCardProps = {
	tenant: TenantItem;
	onClick: () => void;
	shouldAnimate: boolean;
};

export function TenantCard({ tenant, onClick, shouldAnimate }: TenantCardProps) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			whileHover={
				shouldAnimate
					? { x: 4, transition: { type: "spring" as const, stiffness: 200, damping: 12 } }
					: undefined
			}
			whileTap={shouldAnimate ? { scale: 0.98 } : undefined}
			transition={SPRING_DEFAULT}
			className="group flex w-full items-center gap-4 rounded-xl border border-[#e0e0e0] bg-white p-4 text-left shadow-sm transition-colors hover:border-[#0066cc]/40 hover:bg-[#f5f5f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] dark:border-white/10 dark:bg-[#1d1d1f] dark:hover:border-[#2997ff]/40 dark:hover:bg-white/5"
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0066cc]/10 text-[#0066cc]">
				<StoreIcon className="h-5 w-5" />
			</div>

			<div className="min-w-0 flex-1">
				<div className="truncate text-[17px] font-semibold leading-[1.24] tracking-[-0.022em] text-[#1d1d1f] dark:text-white">
					{tenant.nombre}
				</div>
				<div className="truncate text-xs text-[#7a7a7a] dark:text-[#cccccc]">
					{tenant.slug || tenant.tenantId}
				</div>
			</div>

			<motion.div
				initial={shouldAnimate ? { opacity: 0, x: -4 } : { opacity: 1, x: 0 }}
				whileHover={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
				transition={{ duration: 0.2 }}
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]"
			>
				<ArrowRightIcon className="h-4 w-4" />
			</motion.div>
		</motion.button>
	);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function OnboardingSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] dark:bg-[#1d1d1f]">
			<div className="flex flex-col items-center gap-4">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066cc] border-t-transparent" />
				<p className="text-sm text-[#7a7a7a] dark:text-[#cccccc]">
					Preparando tu configuración...
				</p>
			</div>
		</div>
	);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

/**
 * @description Pantalla de onboarding post-registro con diseño Apple.
 *              Sin animaciones decorativas, sin gradientes, tipografía limpia.
 *              Action Blue (#0066cc) como único accent.
 * @returns {JSX.Element}
 */
export default function OnboardingPage(): React.ReactNode {
	const router = useRouter();
	const reduceMotion = useHydrationSafeReducedMotion();
	const isMounted = useIsMounted();
	const shouldAnimate = isMounted && !reduceMotion;

	const [user, setUser] = useState<OnboardingUser | null>(null);
	const [tenants, setTenants] = useState<TenantItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [phone, setPhone] = useState("");

	const onboardingToken =
		typeof window !== "undefined"
			? sessionStorage.getItem("onboardingToken")
			: null;

	// ─── Fetch initial data ────────────────────────────────────────────────

	useEffect(() => {
		const run = async (): Promise<void> => {
			if (!onboardingToken) {
				router.replace("/register");
				return;
			}

			try {
				const response = await fetch("/api/auth/onboarding/me", {
					headers: {
						Authorization: `Bearer ${onboardingToken}`,
						"x-request-id":
							typeof crypto !== "undefined" &&
							typeof crypto.randomUUID === "function"
								? crypto.randomUUID()
								: "",
					},
				});
				const data = await response.json();

				if (!response.ok) {
					setError(data.error || "No se pudo cargar el onboarding");
					setLoading(false);
					return;
				}

				setUser(data.user);
				setTenants(data.tenants);
			} catch {
				setError("Error de conexión. Inténtalo de nuevo.");
			} finally {
				setLoading(false);
			}
		};

		void run();
	}, [onboardingToken, router]);

	// ─── Derived state ─────────────────────────────────────────────────────

	const currentStep = useMemo<OnboardingStep>(() => {
		if (!user) return "type";
		if (user.hasActiveMembership) return "approved";
		if (user.onboardingStatus === "awaiting_manager_approval")
			return "approval";
		if (user.onboardingStatus === "awaiting_sales_agent_approval")
			return "salesAgent";
		if (user.onboardingType === "company") return "company";
		if (user.onboardingType === "worker") return "tenant";
		if (user.onboardingType === "salesAgent") return "completed";
		return "type";
	}, [user]);

	const stepIndex = useMemo(() => {
		if (currentStep === "type") return 0;
		if (currentStep === "tenant") return 1;
		return 2;
	}, [currentStep]);

	const canSelectTenant = useMemo(
		() =>
			user?.onboardingType === "worker" &&
			user?.onboardingStatus !== "awaiting_manager_approval",
		[user],
	);

	// ─── Actions ───────────────────────────────────────────────────────────

	const chooseType = useCallback(
		async (userType: "worker" | "company" | "salesAgent"): Promise<void> => {
			if (!onboardingToken) return;
			let submittedPhone = phone;
			if (userType === "salesAgent") {
				try {
					submittedPhone = normalizeSalesAgentPhone(phone);
				} catch (phoneError) {
					setError(
						phoneError instanceof Error
							? phoneError.message
							: "Ingresa un teléfono válido.",
					);
					return;
				}
			}
			setSubmitting(userType);
			setError(null);

			try {
				const response = await fetch("/api/auth/onboarding/type", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${onboardingToken}`,
						"x-request-id":
							typeof crypto !== "undefined" &&
							typeof crypto.randomUUID === "function"
								? crypto.randomUUID()
								: "",
					},
					body: JSON.stringify({ userType, phone: submittedPhone }),
				});

				const data = await response.json();

				if (!response.ok) {
					setError(data.error || "No se pudo guardar el tipo de usuario");
					return;
				}

				setUser((current) =>
					current
						? {
								...current,
								onboardingType: userType,
								onboardingStatus: data.onboardingStatus,
							}
						: current,
				);
			} catch {
				setError("Error de conexión. Inténtalo de nuevo.");
			} finally {
				setSubmitting(null);
			}
		},
		[onboardingToken, phone],
	);

	const chooseTenant = useCallback(
		async (tenantId: string): Promise<void> => {
			if (!onboardingToken) return;
			setSubmitting(tenantId);
			setError(null);

			try {
				const response = await fetch("/api/auth/onboarding/tenant", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${onboardingToken}`,
						"x-request-id":
							typeof crypto !== "undefined" &&
							typeof crypto.randomUUID === "function"
								? crypto.randomUUID()
								: "",
					},
					body: JSON.stringify({ tenantId }),
				});

				const data = await response.json();

				if (!response.ok) {
					setError(data.error || "No se pudo asociar la empresa");
					return;
				}

				setUser((current) =>
					current
						? {
								...current,
								onboardingStatus: "awaiting_manager_approval",
							}
						: current,
				);
			} catch {
				setError("Error de conexión. Inténtalo de nuevo.");
			} finally {
				setSubmitting(null);
			}
		},
		[onboardingToken],
	);

	// ─── Loading state ─────────────────────────────────────────────────────

	if (loading) {
		return <OnboardingSkeleton />;
	}

	if (!user && !error) {
		return null;
	}

	// ─── Render ────────────────────────────────────────────────────────────

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-12 dark:bg-[#1d1d1f]">
			{/* Background blobs — floating, same as homepage */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<motion.div
					aria-hidden="true"
					className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
					animate={
						shouldAnimate
							? { scale: [1, 1.1, 1], x: ["-50%", "-42%", "-50%"] }
							: undefined
					}
					transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					aria-hidden="true"
					className="absolute bottom-32 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
					animate={
						shouldAnimate ? { y: [0, -32, 0], x: [0, -22, 0] } : undefined
					}
					transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					aria-hidden="true"
					className="absolute left-[-5rem] top-1/3 h-56 w-56 rounded-full bg-primary/5 blur-3xl"
					animate={shouldAnimate ? { y: [0, 24, 0], x: [0, 16, 0] } : undefined}
					transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
				/>
			</div>

			{/* Back link */}
			<Link
				href="/"
				className="absolute left-4 top-4 inline-flex items-center gap-2 text-sm text-[#0066cc] hover:underline dark:text-[#2997ff]"
			>
				<ArrowLeftIcon className="h-4 w-4" />
				Volver al inicio
			</Link>

			{/* Error banner */}
			<AnimatePresence>
				{error && (
					<motion.div
						key="global-error"
						initial={shouldAnimate ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
						animate={{ opacity: 1, y: 0 }}
						exit={shouldAnimate ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed top-4 z-50 w-full max-w-md px-4"
					>
						<Alert
							variant="destructive"
							className="border-red-300 bg-red-50/90 shadow-sm backdrop-blur-sm dark:bg-red-900/30"
						>
							<AlertCircleIcon className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Main card */}
			<motion.div
				initial={shouldAnimate ? { opacity: 0, y: 30 } : { opacity: 1, y: 0 }}
				animate={{ opacity: 1, y: 0 }}
				transition={SPRING_DEFAULT}
				className="w-full max-w-2xl"
			>
				<div className="overflow-hidden rounded-[18px] border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#272729]">
					<div className="px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
						{/* Step Indicator */}
						{user && <StepIndicator currentStep={stepIndex} />}

						{/* ═══════ STEP 1: Choose Type ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "type" && (
								<motion.div
									key="step-type"
									initial={shouldAnimate ? { opacity: 0, x: 20 } : { opacity: 1, x: 0 }}
									animate={{ opacity: 1, x: 0 }}
									exit={shouldAnimate ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
									transition={SPRING_DEFAULT}
								>
							
								<div className="mb-8 text-center">
									<h1 className="mb-2 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
										Bienvenido
										{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
									</h1>
									<p className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[#7a7a7a] dark:text-[#cccccc]">
										Cuéntanos cómo vas a usar FinanceMDM para personalizar tu
										experiencia.
									</p>
								</div>

								<div className="grid gap-4 sm:grid-cols-3">
									<TypeCard
										icon={BriefcaseIcon}
										title="Trabajador"
										description="Accedé a una empresa existente como empleado, dependiente o económico."
										features={[
											"Gestión de inventario y ventas",
											"Reportes asignados por tu manager",
											"Acceso a puntos de venta",
										]}
										shouldAnimate={shouldAnimate}
										onClick={() => void chooseType("worker")}
									/>
									<TypeCard
										icon={Building2Icon}
										title="Empresa"
										description="Configura tu propia organización como manager o administrador."
										features={[
											"Control total de usuarios y roles",
											"Configuración de catálogo",
											"Reportes financieros avanzados",
										]}
										shouldAnimate={shouldAnimate}
										onClick={() => void chooseType("company")}
									/>
									<TypeCard
										icon={StoreIcon}
										title="Gestor de Ventas"
										description="Referí empresas y solicitá tu alta comercial."
										features={[
											"Registro independiente",
											"Aprobación del admin global",
											"Acceso después de la aprobación",
										]}
										shouldAnimate={shouldAnimate}
										onClick={() => void chooseType("salesAgent")}
									/>
								</div>

								<div className="mt-5">
									<label
										htmlFor="sales-agent-phone"
										className="mb-2 block text-sm font-medium text-[#1d1d1f] dark:text-white"
									>
										Teléfono
									</label>
									<input
										id="sales-agent-phone"
										type="tel"
										value={phone}
										onChange={(event) => setPhone(event.target.value)}
										placeholder="+53 555 1234"
										className="w-full rounded-xl border border-[#e0e0e0] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20 dark:border-white/10 dark:bg-[#1d1d1f] dark:text-white"
									/>
									<p className="mt-2 text-xs text-[#7a7a7a] dark:text-[#cccccc]">
										Obligatorio para solicitar acceso como Gestor de Ventas.
									</p>
								</div>

								{submitting && (
									<div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#7a7a7a] dark:text-[#cccccc]">
										<Loader2Icon className="h-4 w-4 animate-spin" />
										Guardando selección...
									</div>
								)}
								</motion.div>
							)}
						</AnimatePresence>

						{/* ═══════ STEP 2: Select Tenant ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "tenant" && canSelectTenant && (
								<motion.div
								key="step-tenant"
								initial={shouldAnimate ? { opacity: 0, x: 20 } : { opacity: 1, x: 0 }}
								animate={{ opacity: 1, x: 0 }}
								exit={shouldAnimate ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
								transition={SPRING_DEFAULT}
							>
							<LogoIcon icon={Building2Icon} />

								<div className="mb-6 text-center">
									<h2 className="mb-2 text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
										Elige tu organización
									</h2>
									<p className="text-sm text-[#7a7a7a] dark:text-[#cccccc]">
										Selecciona la empresa a la que quieres asociarte. Si
										necesitas acceso a más de una, comunícate con el
										administrador.
									</p>
								</div>

								{tenants.length > 0 ? (
									<div className="space-y-3">
										{tenants.map((tenant) => (
											<TenantCard
												key={tenant.tenantId}
												tenant={tenant}
												shouldAnimate={shouldAnimate}
												onClick={() => void chooseTenant(tenant.tenantId)}
											/>
										))}
									</div>
								) : (
									<div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#f5f5f7]/50 p-8 text-center dark:border-white/10 dark:bg-white/5">
										<Building2Icon className="mx-auto mb-3 h-10 w-10 text-[#7a7a7a]/40" />
										<p className="text-sm text-[#7a7a7a] dark:text-[#cccccc]">
											No hay empresas registradas todavía.
										</p>
										<p className="mt-1 text-xs text-[#7a7a7a]/60 dark:text-[#cccccc]/60">
											Comunicate con el administrador para que te agregue.
										</p>
									</div>
								)}

								{submitting && (
									<div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#7a7a7a] dark:text-[#cccccc]">
										<Loader2Icon className="h-4 w-4 animate-spin" />
										Enviando solicitud...
									</div>
								)}
								</motion.div>
							)}
						</AnimatePresence>

						{/* ═══════ STEP 3: Awaiting Approval ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "approval" && (
								<motion.div
								key="step-approval"
								initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
								transition={SPRING_DEFAULT}
								className="text-center"
							>
							<motion.div
								initial={shouldAnimate ? { scale: 0 } : { scale: 1 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
								className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10"
							>
									<svg
										className="h-8 w-8 text-green-600"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M20 6L9 17l-5-5" />
									</svg>
								</motion.div>

								<h2 className="mb-2 text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
									Solicitud enviada
								</h2>
								<p className="mb-6 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
									Tu acceso quedó en espera de aprobación por el manager de la
									empresa seleccionada. Te notificaremos cuando esté listo.
								</p>

								<div className="rounded-xl bg-[#f5f5f7] p-4 dark:bg-white/5">
									<div className="flex items-center gap-3 text-sm">
										<Loader2Icon className="h-4 w-4 animate-spin text-[#0066cc]" />
										<span className="text-[#7a7a7a] dark:text-[#cccccc]">
											Esperando aprobación del manager...
										</span>
									</div>
								</div>

								<p className="mt-6 text-xs text-[#7a7a7a]/60 dark:text-[#cccccc]/60">
									Si tienes dudas, comunícate con soporte.
								</p>
								</motion.div>
							)}
						</AnimatePresence>

						{/* ═══════ STEP 3b: Ya aprobado (onboarding cerrado) ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "approved" && (
								<motion.div
									key="step-approved"
									initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									transition={SPRING_DEFAULT}
									className="text-center"
								>
									<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
										<CheckCircle2Icon className="h-8 w-8 text-green-600" />
									</div>
									<h2 className="mb-2 text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
										Tu acceso fue aprobado
									</h2>
									<p className="mb-6 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
										Ya puedes ingresar a tu espacio de trabajo y comenzar a
										operar.
									</p>
									<Link
										href="/busy/dashboard"
										className="inline-flex items-center gap-2 rounded-xl bg-[#0066cc] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0071e3]"
									>
										Ir a mi espacio
										<ArrowRightIcon className="h-4 w-4" />
									</Link>
								</motion.div>
							)}
						</AnimatePresence>

						<AnimatePresence mode="wait">
							{currentStep === "salesAgent" && (
								<motion.div
									key="step-sales-agent"
									initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									transition={SPRING_DEFAULT}
									className="text-center"
								>
									<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc]/10">
										<StoreIcon className="h-8 w-8 text-[#0066cc]" />
									</div>
									<h2 className="mb-2 text-[24px] font-semibold text-[#1d1d1f] dark:text-white">
										Solicitud en espera
									</h2>
									<p className="mb-6 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
										El administrador global debe aprobar tu alta como Gestor de
										Ventas. Contáctalo para continuar.
									</p>
									<div className="rounded-xl bg-[#f5f5f7] p-4 dark:bg-white/5">
										<span className="text-sm text-[#7a7a7a] dark:text-[#cccccc]">
											Esperando aprobación del administrador...
										</span>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						{/* ═══════ STEP 4: SalesAgent approved (onboarding cerrado) ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "completed" && (
								<motion.div
									key="step-completed"
									initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									transition={SPRING_DEFAULT}
									className="text-center"
								>
									<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
										<CheckCircle2Icon className="h-8 w-8 text-green-600" />
									</div>
									<h2 className="mb-2 text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
										Tu solicitud fue aprobada
									</h2>
									<p className="mb-6 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
										Ya estás listo para operar como Gestor de Ventas. Ingresa a
										tu espacio para compartir tu código y gestionar tus
										referidos.
									</p>
									<Link
										href="/sales-agent/referidos"
										className="inline-flex items-center gap-2 rounded-xl bg-[#0066cc] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0071e3]"
									>
										Ir a mi espacio de ventas
										<ArrowRightIcon className="h-4 w-4" />
									</Link>
								</motion.div>
							)}
						</AnimatePresence>

						{/* ═══════ STEP 3 alt: Company account ═══════ */}
						<AnimatePresence mode="wait">
							{currentStep === "company" && (
								<motion.div
									key="step-company"
									initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
									transition={SPRING_DEFAULT}
									className="text-center"
								>
									<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc]/10">
										<Building2Icon className="h-8 w-8 text-[#0066cc]" />
									</div>

								<h2 className="mb-2 text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
									Empresa en espera
								</h2>
								<p className="mb-6 text-sm leading-relaxed text-[#7a7a7a] dark:text-[#cccccc]">
									Comunícate con el administrador global para garantizar el
									acceso y comenzar a configurar tu empresa.
								</p>

								<div className="rounded-xl bg-[#f5f5f7] p-4 dark:bg-white/5">
									<div className="flex items-center gap-3 text-sm">
										<UsersIcon className="h-4 w-4 text-[#0066cc]" />
										<span className="text-[#7a7a7a] dark:text-[#cccccc]">
											Contácta al admin global para activar tu organización
										</span>
									</div>
								</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</motion.div>
		</div>
	);
}
