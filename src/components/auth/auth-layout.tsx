"use client";

import {
	LazyMotion,
	m as motion,
	AnimatePresence,
	useReducedMotion,
	Variants,
} from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

interface AuthLayoutProps {
	children: ReactNode;
}

/**
 * @description Layout compartido para pantallas de autenticación con animaciones
 * estabilizadas para evitar desajustes SSR/cliente durante la hidratación.
 * @param {AuthLayoutProps} props - Contenido interno de la pantalla de auth.
 * @returns {React.ReactElement} Contenedor visual de autenticación.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
	const pathname = usePathname();
	const reducedMotion = useReducedMotion();
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	const prefersReducedMotion = isHydrated ? reducedMotion : false;

	const pageVariants: Variants = {
		initial: {
			opacity: 0,
			x: prefersReducedMotion ? 0 : -8,
			scale: prefersReducedMotion ? 1 : 0.98,
		},
		animate: {
			opacity: 1,
			x: 0,
			scale: 1,
			transition: {
				duration: prefersReducedMotion ? 0.15 : 0.5,
				ease: [0.22, 1, 0.36, 1] as const,
			},
		},
		exit: {
			opacity: 0,
			x: prefersReducedMotion ? 0 : 8,
			scale: prefersReducedMotion ? 1 : 0.98,
			transition: {
				duration: prefersReducedMotion ? 0.1 : 0.3,
				ease: [0.22, 1, 0.36, 1] as const,
			},
		},
	};

	const backgroundVariants: Variants = {
		initial: { opacity: 0 },
		animate: {
			opacity: 1,
			transition: {
				duration: prefersReducedMotion ? 0.15 : 1,
				ease: "easeOut" as const,
			},
		},
	};

	return (
		<div className="min-h-screen relative overflow-hidden bg-background text-foreground">
			{/* Background blobs — matching landing page style */}
			<motion.div
				variants={backgroundVariants}
				initial="initial"
				animate="animate"
				className="absolute inset-0 overflow-hidden pointer-events-none"
			>
				<div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
				<motion.div
					animate={prefersReducedMotion ? {} : { y: [0, -20, 0] }}
					transition={
						prefersReducedMotion
							? {}
							: { duration: 10, repeat: Infinity, ease: "easeInOut" }
					}
					className="absolute bottom-32 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
				/>
				<motion.div
					animate={prefersReducedMotion ? {} : { y: [0, 24, 0], x: [0, 16, 0] }}
					transition={
						prefersReducedMotion
							? {}
							: { duration: 14, repeat: Infinity, ease: "easeInOut" }
					}
					className="absolute left-[-5rem] top-1/3 h-56 w-56 rounded-full bg-primary/5 blur-3xl"
				/>
			</motion.div>

			{/* Content */}
			<div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
				{/* Back to home button */}
				<Link
					href="/"
					className="absolute top-4 left-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeftIcon className="h-4 w-4" />
					Volver al inicio
				</Link>

				<AnimatePresence mode="wait">
					<motion.div
						key={pathname}
						variants={pageVariants}
						initial="initial"
						animate="animate"
						exit="exit"
						className="w-full max-w-md"
					>
						{children}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
