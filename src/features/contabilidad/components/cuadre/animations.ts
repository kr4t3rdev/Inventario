/**
 * @description Variantes de animación compartidas para Framer Motion.
 * Incluye fadeIn, slideUp, stagger, card effects, accordion, scaleIn.
 */

import type { Variants, Transition } from "framer-motion";

/* ─── Transiciones base ─── */

const spring: Transition = { type: "spring", stiffness: 400, damping: 25 };
const easeOut: Transition = { duration: 0.35, ease: "easeOut" };
const easeOutSlow: Transition = { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] };

/* ─── Fade / Slide ─── */

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 16 },
	visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeDown: Variants = {
	hidden: { opacity: 0, y: -12 },
	visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 0.35 } },
};

export const fadeInScale: Variants = {
	hidden: { opacity: 0, scale: 0.95 },
	visible: { opacity: 1, scale: 1, transition: easeOut },
};

export const slideFromRight: Variants = {
	hidden: { opacity: 0, x: 20 },
	visible: { opacity: 1, x: 0, transition: easeOut },
};

export const slideFromLeft: Variants = {
	hidden: { opacity: 0, x: -16 },
	visible: { opacity: 1, x: 0, transition: easeOut },
};

/* ─── Stagger ─── */

export const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.06, delayChildren: 0.08 },
	},
};

export const staggerSlow: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.1 },
	},
};

/* ─── Cards / Rows ─── */

export const slideRow: Variants = {
	hidden: { opacity: 0, x: -12 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.25, ease: "easeOut" },
	},
};

export const cardSlideUp: Variants = {
	hidden: { opacity: 0, y: 20, scale: 0.97 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.35, ease: "easeOut", delay: i * 0.08 },
	}),
};

export const cardSlideFromRight: Variants = {
	hidden: { opacity: 0, x: 24, scale: 0.97 },
	visible: (i: number) => ({
		opacity: 1,
		x: 0,
		scale: 1,
		transition: { duration: 0.35, ease: "easeOut", delay: i * 0.08 },
	}),
};

/* ─── Hover / Tap ─── */

export const cardHover = {
	whileHover: { scale: 1.02, transition: { duration: 0.2 } },
	whileTap: { scale: 0.98 },
};

export const buttonSpring = {
	whileHover: { scale: 1.04 },
	whileTap: { scale: 0.95 },
	transition: spring as Transition,
};

/* ─── Accordion ─── */

export const accordionContent: Variants = {
	hidden: { height: 0, opacity: 0 },
	visible: {
		height: "auto",
		opacity: 1,
		transition: { duration: 0.3, ease: "easeInOut" },
	},
};

/* ─── Scale in (empty states, badges) ─── */

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.8 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: { type: "spring", stiffness: 300, damping: 20 },
	},
};

/* ─── List item appear ─── */

export const listItem: Variants = {
	hidden: { opacity: 0, y: 10 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.25, ease: "easeOut" },
	},
};
