"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpringSection } from "@/features/landing/utils";
import {
	getPlansPublicAction,
	type PlanDisplay,
} from "@/features/reviews/actions";

/**
 * @description Sección de planes y precios con datos reales desde la BD.
 * Si no hay planes, retorna null.
 * @returns {JSX.Element | null} Grid de planes o null
 */
export function PricingDynamic(): React.JSX.Element | null {
	const [plans, setPlans] = useState<PlanDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getPlansPublicAction().then((data) => {
			setPlans(data);
			setIsLoading(false);
		});
	}, []);

	if (isLoading) return null;
	if (plans.length === 0) return null;

	return (
		<section id="precios" className="space-y-10 scroll-mt-24">
			<SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
				<span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
					Planes
				</span>
				<h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
					Escalá con un plan alineado a tu operación
				</h2>
				<p className="text-muted-foreground sm:text-lg">
					Elegí una base sólida para tu negocio y evolucioná sin migraciones
					complejas.
				</p>
			</SpringSection>

			<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
				{plans.map((plan, index) => (
					<motion.div
						key={plan.planId}
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
							y: -8,
							scale: plan.featured ? 1.025 : 1.015,
							transition: { type: "spring", stiffness: 200, damping: 12 },
						}}
					>
						<Card
							className={`h-full border-border/60 bg-card/85 shadow-md transition-all duration-300 ${
								plan.featured
									? "border-primary/35 bg-primary/[0.05] shadow-primary/10 hover:shadow-primary/20"
									: "shadow-black/[0.03] hover:shadow-lg hover:border-primary/20"
							}`}
						>
							<CardHeader className="space-y-3">
								{plan.featured ? (
									<span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary font-mono">
										Recomendado
									</span>
								) : null}
								<CardTitle className="text-2xl font-mono">
									{plan.name}
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									{plan.description}
								</p>

								{/* Price */}
								<div className="flex items-baseline gap-1">
									<span className="text-3xl font-bold font-mono">
										{plan.price.toLocaleString()}
									</span>
									<span className="text-sm text-muted-foreground font-mono">
										CUP / mes
									</span>
								</div>
							</CardHeader>
							<CardContent className="space-y-5">
								<ul className="space-y-2">
									{plan.bullets.map((bullet) => (
										<li key={bullet} className="flex items-start gap-2 text-sm">
											<CheckCircle2 className="mt-[2px] h-4 w-4 text-primary shrink-0" />
											<span>{bullet}</span>
										</li>
									))}
								</ul>
								<Link href="#contacto" className="block">
									<Button
										className="w-full cursor-pointer gap-2"
										variant={plan.featured ? "default" : "outline"}
									>
										{plan.cta}
										<ArrowRight className="h-4 w-4" />
									</Button>
								</Link>
							</CardContent>
						</Card>
					</motion.div>
				))}
			</div>
		</section>
	);
}
