"use client";

import React from "react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { TESTIMONIAL_ITEMS } from "@/features/landing/data";
import { SpringSection } from "@/features/landing/utils";

/**
 * @description Sección de testimonios con cards de clientes.
 * @returns {JSX.Element} Grid de testimonios
 */
export function LandingTestimonials(): React.JSX.Element {
	return (
		<section id="testimonios" className="space-y-10 scroll-mt-24">
			<SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
				<span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
					Testimonios
				</span>
				<h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
					Lo que dicen nuestros clientes
				</h2>
				<p className="text-muted-foreground sm:text-lg">
					Empresas que ya confían en FinanceMDM para operar con más precisión y
					velocidad.
				</p>
			</SpringSection>

			<div className="grid gap-5 md:grid-cols-3">
				{TESTIMONIAL_ITEMS.map((item, index) => (
					<motion.div
						key={item.author}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.15 }}
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
						<Card className="h-full border-border/60 bg-card/80 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg">
							<CardContent className="flex flex-col gap-4 p-6">
								<svg
									className="h-8 w-8 text-primary/40"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
								>
									<path d="M10 11h-4v-4h4v4zm8 0h-4v-4h4v4z" />
									<path d="M10 13l-4 5h4l-4-5zm8 0l-4 5h4l-4-5z" />
								</svg>
								<p className="text-sm leading-relaxed text-muted-foreground">
									&ldquo;{item.quote}&rdquo;
								</p>
								<div className="mt-auto flex items-center gap-3 pt-2">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary font-mono">
										{item.author
											.split(" ")
											.map((n) => n[0])
											.join("")
											.slice(0, 2)}
									</div>
									<div>
										<p className="text-sm font-semibold font-mono">
											{item.author}
										</p>
										<p className="text-xs text-muted-foreground">{item.role}</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				))}
			</div>
		</section>
	);
}
