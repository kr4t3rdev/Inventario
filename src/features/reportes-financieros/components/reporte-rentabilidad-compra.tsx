"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import {
	PageTransition,
	StaggerContainer,
	StaggerItem,
	AnimatedCard,
} from "@/components/ui/animations";
import { PurchaseSearchBar } from "./purchase-search-bar";
import { SummaryCards } from "./summary-cards-rentabilidad";
import { ChartsRentabilidad } from "./charts-rentabilidad";
import { RentabilidadDetailTable } from "./rentabilidad-detail-table";
import { getRentabilidadCompraAction } from "@/features/reportes-financieros/actions-rentabilidad-compra";
import type {
	ProductoAnalisis,
	ResumenAnalisis,
	CompraResult,
} from "@/features/reportes-financieros/actions-rentabilidad-compra";


interface CompraInfo {
	compraDocumentoId: string;
	numeroFactura: string;
	fechaCompra: string;
	total: number;
	estado: string;
	formaPago: string;
	proveedor?: { vendorId: string; nombre: string } | null;
	cantidadProductos: number;
}

/**
 * @description Orquestador del reporte de rentabilidad por compra.
 *
 *   Maneja estados: initial (sin compra), loading, data, error.
 *   Coordina los subcomponentes PurchaseSearchBar, SummaryCards,
 *   ChartsRentabilidad y RentabilidadDetailTable.
 *
 * @returns {JSX.Element} Vista completa del reporte.
 */import { SURFACE_CARD_CLASS as BASE_SURFACE_CARD_CLASS } from "@/features/reportes-financieros/lib/reporte-styles"

const SURFACE_CARD_CLASS = cn(
  BASE_SURFACE_CARD_CLASS,
  "rounded-2xl border bg-white/75",
)

export function ReporteRentabilidadCompra() {
	const shouldReduceMotion = useReducedMotion();

	const [selectedCompraId, setSelectedCompraId] = useState<string | null>(null);
	const [selectedLabel, setSelectedLabel] = useState<string | undefined>();
	const [compra, setCompra] = useState<CompraInfo | null>(null);
	const [productos, setProductos] = useState<ProductoAnalisis[]>([]);
	const [resumen, setResumen] = useState<ResumenAnalisis | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Cargar análisis al seleccionar una compra
	useEffect(() => {
		if (!selectedCompraId) return;

		let cancelled = false;
		setIsLoading(true);
		setError(null);

		getRentabilidadCompraAction(selectedCompraId)
			.then((r) => {
				if (cancelled) return;
				if (r.success && r.data) {
					setCompra(r.data.compra as CompraInfo);
					setProductos(r.data.productos);
					setResumen(r.data.resumen);
				} else if (!r.success) {
					setError(r.error?.message ?? "Error al cargar el análisis");
				}
			})
			.catch((err) => {
				if (!cancelled) setError(err.message ?? "Error inesperado");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedCompraId]);

	const handleSelectCompra = (compraId: string) => {
		setSelectedCompraId(compraId);
		// Buscar label en el resultado de search (no tenemos el label aquí,
		// se setea después cuando cargue el compra info)
		setSelectedLabel(undefined);
	};

	const fadeInUp = {
		hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
		show: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
		},
	};

	return (
		<PageTransition className="space-y-6">
			{/* Background gradient */}
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
				<div className="absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
				<div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
			</div>

			{/* Header */}
			<motion.div variants={fadeInUp as any} initial="hidden" animate="show">
				<div className="space-y-1">
					<Badge variant="outline">Reporte operativo</Badge>
					<div className="flex items-center gap-3 mt-2">
						<div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
							<BarChart3 className="h-5 w-5" />
						</div>
						<h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
							Rentabilidad por Compra
						</h1>
						<Badge className="border border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
							Asignación FIFO
						</Badge>
					</div>
					<p className="text-muted-foreground pl-11">
						Seleccione una compra para analizar su rentabilidad: ingresos,
						costos, márgenes y días para vender.
					</p>
				</div>
			</motion.div>

			{/* Badges informativos */}
			<StaggerContainer className="grid gap-3 md:grid-cols-3">
				<StaggerItem>
					<Badge variant="outline" className="h-9 px-3">
						Costos reales por lote
					</Badge>
				</StaggerItem>
				<StaggerItem>
					<Badge variant="outline" className="h-9 px-3">
						Asignación FIFO automática
					</Badge>
				</StaggerItem>
				<StaggerItem>
					<Badge variant="outline" className="h-9 px-3">
						Exportación CSV y PDF
					</Badge>
				</StaggerItem>
			</StaggerContainer>

			{/* Purchase Selector */}
			<motion.div variants={fadeInUp as any} initial="hidden" animate="show">
				<Card className={cn(SURFACE_CARD_CLASS, "border-dashed")}>
					<CardContent className="p-4">
						<PurchaseSearchBar
							onSelect={handleSelectCompra}
							selectedId={selectedCompraId ?? undefined}
							selectedLabel={
								selectedLabel
									? undefined // We'll set this after data loads
									: compra
										? `${compra.proveedor?.nombre ?? "Sin proveedor"} · ${compra.numeroFactura || "S/N"} · ${formatCurrency(compra.total)}`
										: undefined
							}
						/>
					</CardContent>
				</Card>
			</motion.div>

			{/* Empty State */}
			{!selectedCompraId && (
				<motion.div variants={fadeInUp as any} initial="hidden" animate="show">
					<Card className={cn(SURFACE_CARD_CLASS, "border-dashed")}>
						<CardContent className="pt-6">
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
								<h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
									Seleccione una compra
								</h3>
								<p className="mt-1 max-w-md text-sm text-muted-foreground">
									Use el buscador para encontrar una compra por proveedor,
									número de factura o producto. Una vez seleccionada, verá el
									análisis completo de rentabilidad con asignación FIFO.
								</p>
							</div>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* Error State */}
			{error && (
				<motion.div variants={fadeInUp as any} initial="hidden" animate="show">
					<Card
						className={cn(
							SURFACE_CARD_CLASS,
							"border-destructive/30 bg-destructive/5",
						)}
					>
						<CardContent className="p-4">
							<p className="text-sm text-destructive">{error}</p>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* Loading State */}
			{isLoading && (
				<div className="space-y-6">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-24 rounded-xl" />
						))}
					</div>
					<Skeleton className="h-[280px] w-full rounded-xl" />
					<Skeleton className="h-[200px] w-full rounded-xl" />
				</div>
			)}

			{/* Data State */}
			{!isLoading && compra && resumen && (
				<StaggerContainer className="space-y-6">
					<StaggerItem>
						<SummaryCards resumen={resumen} />
					</StaggerItem>

					<StaggerItem>
						<ChartsRentabilidad productos={productos} />
					</StaggerItem>

					<StaggerItem>
						<AnimatedCard>
							<Card className={SURFACE_CARD_CLASS}>
								<CardContent className="p-4 sm:p-5">
									<RentabilidadDetailTable
										productos={productos}
										numeroFactura={compra.numeroFactura}
									/>
								</CardContent>
							</Card>
						</AnimatedCard>
					</StaggerItem>
				</StaggerContainer>
			)}
		</PageTransition>
	);
}
