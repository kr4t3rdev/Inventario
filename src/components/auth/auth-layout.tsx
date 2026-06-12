"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

interface AuthLayoutProps {
	children: ReactNode;
}

/**
 * @description Layout Apple-style para autenticación con blobs flotantes
 *              (mismo patrón que el homepage).
 * @param {AuthLayoutProps} props
 * @returns {React.ReactElement}
 */
export function AuthLayout({ children }: AuthLayoutProps) {
	const reduceMotion = !!useReducedMotion();

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-12 dark:bg-[#1d1d1f]">
			{/* Background blobs — floating, same as homepage */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<motion.div
					aria-hidden="true"
					className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
					animate={
						reduceMotion
							? undefined
							: { scale: [1, 1.1, 1], x: ["-50%", "-42%", "-50%"] }
					}
					transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					aria-hidden="true"
					className="absolute bottom-32 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
					animate={
						reduceMotion ? undefined : { y: [0, -32, 0], x: [0, -22, 0] }
					}
					transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					aria-hidden="true"
					className="absolute left-[-5rem] top-1/3 h-56 w-56 rounded-full bg-primary/5 blur-3xl"
					animate={reduceMotion ? undefined : { y: [0, 24, 0], x: [0, 16, 0] }}
					transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
				/>
			</div>

			<Link
				href="/"
				className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 text-sm text-[#0066cc] hover:underline dark:text-[#2997ff]"
			>
				<ArrowLeftIcon className="h-4 w-4" />
				Volver al inicio
			</Link>

			<div className="w-full max-w-md">{children}</div>
		</div>
	);
}
