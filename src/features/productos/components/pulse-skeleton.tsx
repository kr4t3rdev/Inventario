/**
 * @description Skeleton animado con Framer Motion para estados de carga.
 * @module features/productos/components/pulse-skeleton
 */

"use client";

import { motion } from "framer-motion";

/**
 * @description Skeleton animado tipo pulso para placeholders de carga.
 * @param {object} props - Props del componente
 * @param {string} [props.className] - Clases extra para Tailwind
 * @returns {JSX.Element} Skeleton animado
 */
export function PulseSkeleton({ className }: { className?: string }) {
	return (
		<motion.div
			className={`bg-muted rounded ${className}`}
			animate={{ opacity: [0.45, 0.8, 0.45] }}
			transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
		/>
	);
}
