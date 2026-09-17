"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SURFACE_CARD_CLASS as BASE_SURFACE_CARD_CLASS } from "@/features/reportes-financieros/lib/reporte-styles"
import {
	PageTransition,
	StaggerContainer,
	StaggerItem,
	AnimatedCard,
} from "@/components/ui/animations";
import { ReportesShellLoader } from "./reportes-shell-loader";
import type { TransferenciaMovimientos } from "./reportes-inventario";

const ReportesPageLoader = () => <ReportesShellLoader kpis={3} />;

const ReportesInventario = dynamic(
	() =>
		import("./reportes-inventario").then((mod) => ({
			default: mod.default,
		})),
	{
		loading: () => <ReportesPageLoader />,
	},
);

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const statusBadgeClass = cn(
	"border border-rose-200/80 bg-rose-50/80 text-rose-700",
	"dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300",
);

interface ReportesPageClientProps {
	initialTransferencias: TransferenciaMovimientos[];
}

/**
 * @description Shell de diseño para la página de reportes de inventario.
 * @returns {JSX.Element} Vista animada con header, estados y contenido.
 */
const SURFACE_CARD_CLASS = cn(
  BASE_SURFACE_CARD_CLASS,
  "rounded-2xl border bg-white/75",
)

export function ReportesPageClient({
	initialTransferencias,
}: ReportesPageClientProps) {
	const shouldReduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const fadeInUp = {
		hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
		show: {
			opacity: 1,
			y: 0,
			transition: {
				duration: shouldReduceMotion ? 0 : 0.42,
				ease: EASE_OUT,
			},
		},
	};

	if (!mounted) {
		return (
			<SidebarProvider>
				<SidebarInset className="bg-background">
					<div className="space-y-8 p-8">
						<ReportesPageLoader />
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	return (
		<SidebarProvider>
			<SidebarInset className="bg-background">
				<PageTransition className="space-y-8 p-8">
					<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
						<div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
						<div className="absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
						<div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
					</div>

					<motion.div variants={fadeInUp} initial="hidden" animate="show">
						<Badge variant="outline">Módulo de reportes</Badge>
					</motion.div>

					<motion.div
						variants={fadeInUp}
						initial="hidden"
						animate="show"
						className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
					>
						<div className="space-y-1">
							<div className="flex items-center gap-3">
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-muted-foreground hover:text-foreground"
									asChild
								>
									<Link href="/busy" aria-label="Volver al panel principal">
										<ArrowLeft className="h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
								<div className="flex items-center gap-3">
									<div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
										<BarChart3 className="h-5 w-5" />
									</div>
									<h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
										Reportes de Inventario
									</h1>
								</div>
							</div>
							<p className="pl-11 text-muted-foreground">
								Genera análisis por categoría, ubicación y movimientos con una
								navegación rápida.
							</p>
						</div>

						<Badge className={statusBadgeClass}>
							Visualización mejorada
						</Badge>
					</motion.div>

					<StaggerContainer className="grid gap-3 md:grid-cols-4">
						<StaggerItem>
							<Badge variant="outline" className="h-9 px-3">
								Reporte general consolidado
							</Badge>
						</StaggerItem>
						<StaggerItem>
							<Badge variant="outline" className="h-9 px-3">
								Filtros por categoría y almacén
							</Badge>
						</StaggerItem>
						<StaggerItem>
							<Badge variant="outline" className="h-9 px-3">
								Historial de movimientos
							</Badge>
						</StaggerItem>
						<StaggerItem>
							<Link href="/busy/reportes/rentabilidad-compra">
								<Badge
									variant="outline"
									className="h-9 cursor-pointer px-3 transition-colors hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-900/20"
								>
									<BarChart3 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
									Rentabilidad por Compra
								</Badge>
							</Link>
						</StaggerItem>
					</StaggerContainer>

					<motion.div variants={fadeInUp} initial="hidden" animate="show">
						<div className={SURFACE_CARD_CLASS}>
							<ReportesInventario
								initialTransferencias={
									initialTransferencias as TransferenciaMovimientos[]
								}
							/>
						</div>
					</motion.div>
				</PageTransition>
			</SidebarInset>
		</SidebarProvider>
	);
}
