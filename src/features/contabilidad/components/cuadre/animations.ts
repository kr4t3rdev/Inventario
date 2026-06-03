/**
 * @description Variantes de animación compartidas para Framer Motion.
 * Patrones: fadeIn, slideUp, staggerContainer, cardHover, springTap.
 */

import type { Variants } from "framer-motion";

/** @description Fade in con desplazamiento vertical */
export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 16 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.4, ease: "easeOut" },
	},
};

/** @description Fade in simple */
export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.35, ease: "easeOut" },
	},
};

/** @description Contenedor con stagger children */
export const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.06,
			delayChildren: 0.1,
		},
	},
};

/** @description Slide desde la izquierda (para filas de tabla) */
export const slideRow: Variants = {
	hidden: { opacity: 0, x: -12 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.25, ease: "easeOut" },
	},
};

/** @description Slide up para cards de totales */
export const cardSlideUp: Variants = {
	hidden: { opacity: 0, y: 20, scale: 0.97 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			duration: 0.35,
			ease: "easeOut",
			delay: i * 0.08,
		},
	}),
};

/** @description Hover en cards */
export const cardHover = {
	whileHover: { scale: 1.02, transition: { duration: 0.2 } },
	whileTap: { scale: 0.98 },
};

/** @description Spring feedback para botones */
export const buttonSpring = {
	whileHover: { scale: 1.04 },
	whileTap: { scale: 0.95 },
	transition: { type: "spring" as const, stiffness: 400, damping: 17 },
};
