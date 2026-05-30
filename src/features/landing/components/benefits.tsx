"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

import { Card, CardContent } from "@/components/ui/card";
import { BENEFIT_ITEMS } from "@/features/landing/data";
import { ParallaxLayer } from "@/features/landing/utils";

/**
 * @description Sección de beneficios con imagen destacada y cards de valor.
 * @returns {JSX.Element} Grid de beneficios
 */
export function LandingBenefits(): React.JSX.Element {
	return (
		<section
			id="beneficios"
			className="grid items-start gap-8 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-10 lg:grid-cols-[1fr_1.05fr]"
		>
			<motion.div
				initial={{ opacity: 0, x: -30 }}
				whileInView={{ opacity: 1, x: 0 }}
				viewport={{ once: true, amount: 0.2 }}
				transition={{ type: "spring", stiffness: 120, damping: 20 }}
				className="space-y-4"
			>
				<span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
					Beneficios
				</span>
				<h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
					Menos tareas manuales, más control del negocio
				</h2>
				<p className="text-muted-foreground sm:text-lg">
					FinanceMDM te permite operar con velocidad y precisión desde cualquier
					área: administración, ventas, inventario y finanzas.
				</p>
				<ParallaxLayer speed={0.15}>
					<motion.div
						className="overflow-hidden rounded-asymmetric-tr-bl border border-primary/20 bg-card p-2"
						whileHover={{ scale: 1.015 }}
						transition={{ type: "spring", stiffness: 200, damping: 12 }}
					>
						<Image
							src="/images/Beneficios.jpg"
							alt="Dashboard de análisis financiero"
							width={760}
							height={560}
							className="h-auto w-full rounded-xl object-cover transition-transform duration-700 group-hover:scale-105"
						/>
					</motion.div>
				</ParallaxLayer>
			</motion.div>

			<div className="grid gap-4 sm:grid-cols-2">
				{BENEFIT_ITEMS.map((benefit, index) => {
					const Icon = benefit.icon;

					return (
						<motion.div
							key={benefit.title}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, amount: 0.2 }}
							transition={{
								type: "spring",
								stiffness: 120,
								damping: 20,
								delay: index * 0.1,
							}}
							whileHover={{
								y: -6,
								scale: 1.02,
								transition: { type: "spring", stiffness: 200, damping: 15 },
							}}
						>
							<Card className="h-full border-border/60 bg-card/85 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/25">
								<CardContent className="space-y-3 p-5">
									<motion.div
										className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"
										animate={{ y: [0, -4, 0] }}
										transition={{
											duration: 3 + index * 0.3,
											repeat: Infinity,
											ease: "easeInOut",
										}}
									>
										<Icon className="h-5 w-5 text-primary" />
									</motion.div>
									<h3 className="text-lg font-semibold font-mono">
										{benefit.title}
									</h3>
									<p className="text-sm text-muted-foreground">
										{benefit.description}
									</p>
								</CardContent>
							</Card>
						</motion.div>
					);
				})}
			</div>
		</section>
	);
}
