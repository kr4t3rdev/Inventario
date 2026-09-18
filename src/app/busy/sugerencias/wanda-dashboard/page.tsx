"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2, Coins } from "lucide-react";
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GaugeChart } from "@/components/sugerencias/wanda/gauge-chart";
import { TotalFacturadoChart } from "@/components/sugerencias/wanda/total-facturado-chart";
import { SummaryCard } from "@/components/sugerencias/wanda/summary-card";
import { TimeInRegister } from "@/components/sugerencias/wanda/time-in-register";
import { SalesByMonthBarChart } from "@/components/sugerencias/wanda/sales-by-month-bar-chart";
import { CurrencyDonut } from "@/components/sugerencias/wanda/currency-donut";
import { PaymentChannelDotPlot } from "@/components/sugerencias/wanda/payment-channel-dot-plot";
import { ShiftBillingBarChart } from "@/components/sugerencias/wanda/shift-billing-bar-chart";
import { TopChannelsList } from "@/components/sugerencias/wanda/top-channels-list";
import { PerformanceIndicators } from "@/components/sugerencias/wanda/performance-indicators";
import { chartPalette } from "@/components/sugerencias/wanda/chart-theme";
import {
	PageTransition,
	StaggerContainer,
	StaggerItem,
	AnimatedCard,
} from "@/components/ui/animations";
import { Skeleton } from "@/components/ui/skeleton";

interface WandaDashboardData {
	gaugeChart: {
		titulo: string;
		data: Array<{
			nombre: string;
			total: number;
			cantidad: number;
			color: string;
		}>;
		totalGeneral: number;
	};
	totalFacturadoChart: {
		titulo: string;
		data: Array<{
			fecha: string;
			total: number;
			acumulado: number;
		}>;
		tendencia: number;
	};
	summaryCard: {
		totalFacturado: number;
		totalVentas: number;
		totalServicios: number;
		cantidadTransacciones: number;
		ticketPromedio: number;
		variacionPorcentual: number;
		periodo: {
			desde: string;
			hasta: string;
		};
	};
	timeInRegister: {
		titulo: string;
		empleados: Array<{
			empleadoId: string;
			nombre: string;
			horasTotales: number;
			diasTrabajados: number;
			promedioDiario: number;
		}>;
		totalHoras: number;
		promedioGeneral: number;
	};
	salesByMonthBarChart: {
		titulo: string;
		data: Array<{
			mes: string;
			ventas: number;
			servicios: number;
			total: number;
			cantidadVentas: number;
			cantidadServicios: number;
		}>;
	};
	currencyDonut: {
		titulo: string;
		data: Array<{
			codigo: string;
			nombre: string;
			simbolo: string;
			total: number;
			color: string;
		}>;
	};
	paymentChannelDotPlot: {
		titulo: string;
		data: Array<{
			canal: string;
			monto: number;
			cantidad: number;
			valorNormalizado: number;
			color: string;
		}>;
	};
	shiftBillingBarChart: {
		titulo: string;
		data: Array<{
			turno: string;
			inicio: number;
			fin: number;
			total: number;
			cantidad: number;
			color: string;
		}>;
	};
	topChannelsList: {
		titulo: string;
		data: Array<{
			posicion: number;
			canal: string;
			total: number;
			cantidad: number;
			porcentaje: number;
			tendencia: number;
			color: string;
		}>;
	};
	performanceIndicators: {
		titulo: string;
		tasaConversion: number;
		promedioReconciliacionesDiarias: number;
		totalReconciliaciones: number;
		eficienciaPorPuntoVenta: Array<{
			puntoVenta: string;
			totalVentas: number;
			reconciliadas: number;
			eficiencia: number;
		}>;
		diasAnalizados: number;
	};
}

/**
 * @description Página del dashboard Wanda con métricas y gráficos.
 * @returns {JSX.Element | null} Vista principal del dashboard.
 */
export default function WandaDashboardPage() {
	const [data, setData] = useState<WandaDashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const shouldReduceMotion = useReducedMotion();

	const fetchData = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch("/api/dashboard/wanda");

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error(
						"Sesión expirada. Por favor, inicie sesión nuevamente.",
					);
				}
				throw new Error("Error al cargar datos del dashboard");
			}

			const result = await response.json();
			setData(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error desconocido");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	if (loading) {
		return (
			<div className="container mx-auto py-8">
				<motion.div
					className="flex items-center justify-between mb-6"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<div className="flex items-center gap-2">
						<Skeleton className="h-10 w-10 rounded-xl" />
						<Skeleton className="h-8 w-48" />
					</div>
					<Skeleton className="h-10 w-32" />
				</motion.div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
					<Skeleton className="h-40 rounded-xl" />
					<Skeleton className="h-40 rounded-xl" />
					<Skeleton className="h-40 rounded-xl" />
				</div>
				<Skeleton className="h-100 rounded-xl" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto py-8">
				<motion.div
					className="flex flex-col items-center justify-center h-[60vh] gap-4"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
				>
					<div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
						<Coins className="h-8 w-8 text-red-500" />
					</div>
					<p className="text-red-500 font-medium">{error}</p>
					<Button onClick={fetchData} variant="outline">
						<RefreshCw className="h-4 w-4 mr-2" />
						Reintentar
					</Button>
				</motion.div>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	// Calcular porcentajes para los gauges
	const canalesGauge = data.gaugeChart.data.slice(0, 3).map((canal, index) => {
		const porcentaje =
			data.gaugeChart.totalGeneral > 0
				? Math.round((canal.total / data.gaugeChart.totalGeneral) * 100)
				: 0;

		const labels = ["Efectivo", "Electrónico", "Otros Medios"];
		const colors = [
			chartPalette.accentPrimary,
			chartPalette.accentSecondary,
			chartPalette.alert,
		];

		return {
			...canal,
			label: labels[index] || canal.nombre,
			color: colors[index] || canal.color,
			value: porcentaje,
		};
	});

	return (
		<PageTransition className="relative min-h-screen w-full">
			{/* Background Decor */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				<div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob" />
				<div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl dark:bg-blue-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
				<div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl dark:bg-amber-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
			</div>

			<StaggerContainer className="container mx-auto p-4 space-y-4">
				{/* Header */}
				<StaggerItem>
					<motion.div className="flex justify-between items-center">
						<div className="flex items-center gap-3">
							<motion.div
								className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-600 to-blue-600 shadow-lg"
								whileHover={{ scale: 1.05, rotate: 5 }}
								transition={{ duration: 0.2 }}
							>
								<Coins className="h-5 w-5 text-white" />
							</motion.div>
							<div>
								<h1 className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
									Wanda Dashboard
								</h1>
								<p className="text-muted-foreground text-sm">
									Métricas y análisis de ventas
								</p>
							</div>
						</div>
						<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
							<Button
								onClick={fetchData}
								variant="outline"
								size="sm"
								disabled={loading}
							>
								<RefreshCw
									className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
								/>
								Actualizar
							</Button>
						</motion.div>
					</motion.div>
				</StaggerItem>

				{/* Row 1: Totales Por Canal (Gauges) + Line Chart + Summary */}
				<StaggerItem>
					<div className="grid grid-cols-12 gap-4 min-h-[240px]">
						{/* Gauges Section - Span 3 */}
						<AnimatedCard className="col-span-12 lg:col-span-3 bg-card text-card-foreground p-4 rounded-lg border shadow-sm flex flex-col">
							<div className="flex justify-between items-start mb-2">
								<h3 className="text-sm font-semibold">
									{data.gaugeChart.titulo}
								</h3>
								<Coins className="h-4 w-4 text-amber-500" aria-hidden="true" />
							</div>
							<div className="flex-1 grid grid-cols-3 gap-2">
								{canalesGauge.map((canal) => (
									<GaugeChart
										key={canal.label}
										value={canal.value}
										label={canal.label}
										color={canal.color}
										total={canal.total}
										cantidad={canal.cantidad}
									/>
								))}
							</div>
						</AnimatedCard>

						{/* Line Chart - Span 6 */}
						<div className="col-span-12 lg:col-span-6">
							<TotalFacturadoChart
								data={data.totalFacturadoChart.data}
								tendencia={data.totalFacturadoChart.tendencia}
							/>
						</div>

						{/* Summary Card - Span 3 */}
						<div className="col-span-12 lg:col-span-3">
							<SummaryCard
								totalFacturado={data.summaryCard.totalFacturado}
								totalVentas={data.summaryCard.totalVentas}
								totalServicios={data.summaryCard.totalServicios}
								cantidadTransacciones={data.summaryCard.cantidadTransacciones}
								ticketPromedio={data.summaryCard.ticketPromedio}
								variacionPorcentual={data.summaryCard.variacionPorcentual}
							/>
						</div>
					</div>
				</StaggerItem>

				{/* Row 2: Main Content Columns */}
				<StaggerItem>
					<div className="grid grid-cols-12 gap-4">
						{/* Column 1: Performance Indicators - Span 3 */}
						<div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4">
							<AnimatedCard className="h-full">
								<PerformanceIndicators
									tasaConversion={data.performanceIndicators.tasaConversion}
									promedioReconciliacionesDiarias={
										data.performanceIndicators.promedioReconciliacionesDiarias
									}
									totalReconciliaciones={
										data.performanceIndicators.totalReconciliaciones
									}
									eficienciaPorPuntoVenta={
										data.performanceIndicators.eficienciaPorPuntoVenta
									}
									diasAnalizados={data.performanceIndicators.diasAnalizados}
								/>
							</AnimatedCard>
						</div>

						{/* Column 2: Time in Register & Sales Bars - Span 6 */}
						<div className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col gap-4">
							{/* Main Grid: Left (Time) vs Right (Sales + Billing) */}
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								{/* Left: TimeInRegister */}
								<AnimatedCard className="h-full sm:col-span-1">
									<TimeInRegister
										empleados={data.timeInRegister.empleados}
										totalHoras={data.timeInRegister.totalHoras}
										promedioGeneral={data.timeInRegister.promedioGeneral}
									/>
								</AnimatedCard>

								{/* Right: Sales + Donut/Dots */}
								<div className="h-full sm:col-span-2 flex flex-col gap-4">
									<AnimatedCard className="flex-1 min-h-[200px]">
										<SalesByMonthBarChart
											data={data.salesByMonthBarChart.data}
										/>
									</AnimatedCard>

									<div className="grid grid-cols-3 gap-4 h-[180px]">
										{/* Currency Donut */}
										<AnimatedCard className="col-span-1">
											<CurrencyDonut data={data.currencyDonut.data} />
										</AnimatedCard>
										{/* Payment Channel Dot Plot */}
										<AnimatedCard className="col-span-2">
											<PaymentChannelDotPlot
												data={data.paymentChannelDotPlot.data}
											/>
										</AnimatedCard>
									</div>
								</div>
							</div>

							{/* Row C: ShiftBillingBarChart (3/3) */}
							<AnimatedCard className="w-full min-h-[220px]">
								<ShiftBillingBarChart data={data.shiftBillingBarChart.data} />
							</AnimatedCard>
						</div>

						{/* Column 3: Summary & Top 4 - Span 3 */}
						<div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
							{/* Resumen Pills */}
							<AnimatedCard className="bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
								<div className="flex justify-between items-center bg-purple-100 dark:bg-purple-900/20 rounded-full p-1 mb-2">
									<span className="bg-purple-700 text-white px-3 py-1 rounded-full text-sm font-bold">
										{data.summaryCard.cantidadTransacciones.toLocaleString()}
									</span>
									<span className="text-purple-900 dark:text-purple-300 font-semibold text-sm pr-3">
										Ventas
									</span>
								</div>
								<div className="flex justify-between text-xs text-muted-foreground px-2">
									<div className="text-center">
										<div className="font-bold text-foreground">
											{Math.max(
												...data.salesByMonthBarChart.data.map(
													(d) => d.cantidadVentas + d.cantidadServicios,
												),
											).toLocaleString()}
										</div>
										<div>Máximo</div>
										<div className="text-[10px]">
											{
												data.salesByMonthBarChart.data.reduce((max, d) =>
													d.cantidadVentas + d.cantidadServicios >
													max.cantidadVentas + max.cantidadServicios
														? d
														: max,
												).mes
											}
										</div>
									</div>
									<div className="text-center">
										<div className="font-bold text-foreground">
											{Math.min(
												...data.salesByMonthBarChart.data.map(
													(d) => d.cantidadVentas + d.cantidadServicios,
												),
											).toLocaleString()}
										</div>
										<div>Mínimo</div>
										<div className="text-[10px]">
											{
												data.salesByMonthBarChart.data.reduce((min, d) =>
													d.cantidadVentas + d.cantidadServicios <
													min.cantidadVentas + min.cantidadServicios
														? d
														: min,
												).mes
											}
										</div>
									</div>
								</div>
							</AnimatedCard>

							{/* Top 4 List */}
							<AnimatedCard className="flex-1">
								<TopChannelsList data={data.topChannelsList.data} />
							</AnimatedCard>
						</div>
					</div>
				</StaggerItem>
			</StaggerContainer>
		</PageTransition>
	);
}
