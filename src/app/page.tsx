"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
	LandingStatsDynamic,
	PricingDynamic,
	ReviewHeroBadge,
	RealTestimonials,
} from "@/features/reviews";
import {
	AwsIcon,
	FramerIcon,
	NextjsIcon,
	OpenaiIcon,
	PostgresIcon,
	PrismaIcon,
	RadixIcon,
	ReactIcon,
	TailwindIcon,
	TypeScriptIcon,
	VitestIcon,
	ZodIcon,
} from "@/components/ui/icons/tech";
import { MarqueeText } from "@/components/ui/marquee-text";
import {
	LandingBenefits,
	LandingContact,
	LandingFaq,
	LandingFeatures,
	LandingFooter,
	LandingHeader,
	LandingHero,
	LandingPreloader,
} from "@/features/landing";

/**
 * @description Página principal del producto con narrativa visual animada
 *              y enfoque Bungee-inspired (dark industrial + animaciones spring).
 * @returns {JSX.Element} Landing page con spring animations y tipografía Chivo Mono.
 */
export default function Home(): React.JSX.Element {
	const reduceMotion = useReducedMotion();
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const timeout = window.setTimeout(
			() => {
				setIsLoading(false);
			},
			reduceMotion ? 240 : 1500,
		);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [reduceMotion]);

	return (
		<div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
			<AnimatePresence>
				{isLoading ? <LandingPreloader reduceMotion={!!reduceMotion} /> : null}
			</AnimatePresence>

			{/* Background blobs — parallax + floating */}
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<motion.div
					aria-hidden="true"
					className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
					animate={
						reduceMotion
							? undefined
							: { scale: [1, 1.1, 1], x: ["-50%", "-42%", "-50%"] }
					}
					transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
					style={{ transform: "translateX(-50%)" }}
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

			<LandingHeader reduceMotion={!!reduceMotion} />

			<main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 pb-20 pt-10 md:px-6 md:pt-14">
				{/* ═══ HERO ═══ */}
				<LandingHero reduceMotion={!!reduceMotion} />

				{/* ═══ REVIEW BADGE ═══ */}
				<ReviewHeroBadge />

				{/* ═══ STATS ═══ */}
				<LandingStatsDynamic />

				{/* ═══ MARQUEE 1 ═══ */}
				<MarqueeText
					text="Ventas · Inventario · Contabilidad · Capital Humano · Reportes · Automatización"
					speed={25}
				/>

				{/* ═══ FEATURES ═══ */}
				<LandingFeatures />

				{/* ═══ BENEFITS ═══ */}
				<LandingBenefits />

				{/* ═══ TECH STACK MARQUEE ═══ */}
				<MarqueeText
					speed={35}
					iconSize={14}
					items={[
						{ icon: <NextjsIcon />, href: "https://nextjs.org" },
						{ icon: <ReactIcon />, href: "https://react.dev" },
						{
							icon: <TypeScriptIcon />,
							href: "https://www.typescriptlang.org",
						},
						{ icon: <TailwindIcon />, href: "https://tailwindcss.com" },
						{ icon: <PrismaIcon />, href: "https://www.prisma.io" },
						{ icon: <PostgresIcon />, href: "https://www.postgresql.org" },
						{ icon: <RadixIcon />, href: "https://www.radix-ui.com" },
						{ icon: <ZodIcon />, href: "https://zod.dev" },
						{ icon: <FramerIcon />, href: "https://www.framer.com/motion" },
						{ icon: <VitestIcon />, href: "https://vitest.dev" },
						{ icon: <AwsIcon />, href: "https://aws.amazon.com" },
						{ icon: <OpenaiIcon />, href: "https://openai.com" },
					]}
					direction="left"
				/>

				{/* ═══ TESTIMONIALS ═══ */}
				<RealTestimonials />

				{/* ═══ PRICING ═══ */}
				<PricingDynamic />

				{/* ═══ MARQUEE 3 ═══ */}
				<MarqueeText
					text="Soporte dedicado · Integraciones · Analytics · Crecimiento sin límites"
					speed={35}
				/>

				{/* ═══ FAQ ═══ */}
				<LandingFaq />

				{/* ═══ CONTACT ═══ */}
				<LandingContact reduceMotion={!!reduceMotion} />
			</main>

			<LandingFooter />
		</div>
	);
}
