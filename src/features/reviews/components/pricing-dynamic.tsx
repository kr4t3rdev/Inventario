"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
	ArrowRight,
	CheckCircle2,
	Users,
	Archive,
	Package,
	Building2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpringSection } from "@/features/landing/utils";
import {
	getPlansPublicAction,
	type PlanDisplay,
} from "@/features/reviews/actions";

/** Iconos por categoría de feature */
const CATEGORY_ICONS: Record<string, string> = {
	Inventario: "📦",
	Operaciones: "🏭",
	Ventas: "🛒",
	Compras: "📋",
	Financiero: "💰",
	Producción: "⚙️",
	RRHH: "👥",
	"Empresa y Configuración": "⚡",
	Infraestructura: "🛡️",
};

/**
 * @description Sección de planes y precios con datos reales desde la BD.
 * Muestra módulos agrupados por categoría y límites del plan.
 * @returns {JSX.Element | null} Grid de planes o null
 */
const MAX_FEATURES_VISIBLE = 8;

export function PricingDynamic(): React.JSX.Element | null {
	const [plans, setPlans] = useState<PlanDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

	useEffect(() => {
		getPlansPublicAction().then((data) => {
			setPlans(data);
			setIsLoading(false);
		});
	}, []);

	function togglePlanExpand(planId: string) {
		setExpandedPlans((prev) => {
			const next = new Set(prev);
			if (next.has(planId)) next.delete(planId);
			else next.add(planId);
			return next;
		});
	}

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
							className={`h-full border-border/60 bg-card/85 shadow-md transition-all duration-300 flex flex-col ${
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
										${plan.price.toLocaleString()}
									</span>
									<span className="text-sm text-muted-foreground font-mono">
										USD / mes
									</span>
								</div>

								{/* Límites como badges */}
								<div className="flex flex-wrap gap-1.5 pt-1">
									<Badge
										variant="outline"
										className="text-[10px] font-normal gap-1"
									>
										<Users className="h-3 w-3" />
										{plan.limits.maxUsuarios >= 999
											? "∞ usuarios"
											: `${plan.limits.maxUsuarios} users`}
									</Badge>
									<Badge
										variant="outline"
										className="text-[10px] font-normal gap-1"
									>
										<Archive className="h-3 w-3" />
										{plan.limits.maxAlmacenes >= 999
											? "∞ almacenes"
											: `${plan.limits.maxAlmacenes} almacenes`}
									</Badge>
									<Badge
										variant="outline"
										className="text-[10px] font-normal gap-1"
									>
										<Package className="h-3 w-3" />
										{plan.limits.maxProductos >= 999999
											? "∞ productos"
											: `${plan.limits.maxProductos.toLocaleString()} prod.`}
									</Badge>
									<Badge
										variant="outline"
										className="text-[10px] font-normal gap-1"
									>
										<Building2 className="h-3 w-3" />
										{plan.limits.maxPuntosVenta >= 999
											? "∞ PDV"
											: `${plan.limits.maxPuntosVenta} PDV`}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-5 flex-1 flex flex-col">
								{/* Módulos agrupados por categoría */}
								{Object.entries(plan.featuresByCategory).length > 0 && (
									<div className="space-y-2.5 flex-1">
										{Object.entries(plan.featuresByCategory).map(
											([category, features]) => {
												const isExpanded = expandedPlans.has(
													plan.planId,
												);
												const visible = isExpanded
													? features
													: features.slice(0, MAX_FEATURES_VISIBLE);
												const hiddenCount = features.length - MAX_FEATURES_VISIBLE;

												return (
													<div key={category}>
														<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
															{CATEGORY_ICONS[category] || "📋"}{" "}
															{category}
														</p>
														<ul className="space-y-1">
															{visible.map((feature) => (
																<li
																	key={feature}
																	className="flex items-start gap-2 text-xs"
																>
																	<CheckCircle2 className="mt-[2px] h-3 w-3 text-primary shrink-0" />
																	<span>{feature}</span>
																</li>
															))}
														</ul>

														{/* Si está colapsado y hay features ocultas en esta categoría, mostrar badge */}
														{!isExpanded && features.length > MAX_FEATURES_VISIBLE && (
															<p className="text-[10px] text-muted-foreground italic ml-0.5 mt-1">
																+{hiddenCount} módulos
															</p>
														)}
													</div>
												);
											},
										)}

										{/* Botón global expandir/colapsar del plan */}
										{(() => {
											const totalFeatures = Object.values(
												plan.featuresByCategory,
											).flat().length;
											const isExpanded = expandedPlans.has(plan.planId);

											if (totalFeatures <= MAX_FEATURES_VISIBLE) return null;

											return (
												<button
													type="button"
													onClick={() => togglePlanExpand(plan.planId)}
													className="w-full text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1"
												>
													{isExpanded
														? "Mostrar menos módulos"
														: `Ver todos los ${totalFeatures} módulos`}
												</button>
											);
										})()}
									</div>
								)}

								{/* CTA */}
								<Link href="#contacto" className="block mt-auto">
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
