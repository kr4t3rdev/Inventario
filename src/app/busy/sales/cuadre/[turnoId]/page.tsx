/**
 * @description Página de cuadre de turno POS con gráficos y resumen completo.
 * Muestra distribución de pagos, top productos vendidos, tabla de inventario
 * y permite cerrar el turno o volver al POS.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import {
	CheckCircle2,
	AlertTriangle,
	ArrowLeft,
	Store,
	User,
	DollarSign,
	ShoppingCart,
	Package,
	TrendingUp,
	Banknote,
	ImageIcon,
} from "lucide-react";
import { cerrarTurnoAction } from "@/features/turnos-pos/actions";
import { getCuadreTurnoAction } from "@/features/turnos-pos/actions-cuadre";
import type { CuadreTurnoData } from "@/features/turnos-pos/actions-cuadre";
import {
	CuadreDetailActions,
	CuadreDetailReadonlyNotice,
} from "@/features/turnos-pos/components/cuadre-detail-mode";
import { ArqueoForm } from "@/features/arqueo-caja";

// ─── Animaciones ──────────────────────────────────────────

const containerVariants: Variants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.1 },
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 24 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
	},
};

const chartColors = {
	cup: "#16a34a",
	usd: "#2563eb",
	tarjeta: "#9333ea",
	transferencia: "#0891b2",
	credito: "#d97706",
};

// ─── Página ───────────────────────────────────────────────

export default function CuadrePage() {
	const router = useRouter();
	const params = useParams();
	const searchParams = useSearchParams();
	const turnoId = params.turnoId as string;
	const fromHistory = searchParams.get("from") === "history";

	const [data, setData] = useState<CuadreTurnoData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isClosing, setIsClosing] = useState(false);
	const [isArqueoDialogOpen, setIsArqueoDialogOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!turnoId) return;

		const load = async () => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await getCuadreTurnoAction(turnoId);
				if (!result.success) {
					setError(result.error.message ?? "Error al cargar cuadre");
					return;
				}
				setData(result.data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Error al cargar cuadre");
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [turnoId]);

	const handleCerrarTurno = async () => {
		setIsClosing(true);
		try {
			const result = await cerrarTurnoAction({ turnoId });
			if (!result.success) {
				toast.error(result.error.message ?? "Error al cerrar turno");
				return;
			}
			toast.success("Turno cerrado exitosamente");
			router.push("/busy/sales/new");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Error al cerrar turno");
		} finally {
			setIsClosing(false);
		}
	};

	const handleRepetirArqueo = () => {
		setIsArqueoDialogOpen(true);
	};

	const handleArqueoSuccess = () => {
		setIsArqueoDialogOpen(false);
		// Recargar datos del cuadre para reflejar el nuevo arqueo
		getCuadreTurnoAction(turnoId).then((result) => {
			if (!result.success) {
				toast.error("Error al recargar cuadre después del arqueo");
				return;
			}
			setData(result.data);
		});
	};

	// ── Datos para gráficos ────────────────────────────────

	// totalEfectivoCup incluye fondoInicialCup, restamos para obtener ingresos por ventas
	const arqueoTotalCup = data?.arqueo
		? (data.arqueo.totalEfectivoCup -
				data.turno.fondoInicialCup +
				data.arqueo.totalTarjeta +
				data.arqueo.totalTransferencia +
				data.arqueo.totalCredito) /
			100
		: 0;

	const totalVenta = data?.totalVentaTurno ?? 0;
	const diferencia = arqueoTotalCup - totalVenta;
	const tieneDiferencia = Math.abs(diferencia) > 0.01;
	const isReadOnly = data?.turno.estado === "CERRADO";
	const backHref = fromHistory || isReadOnly ? "/busy/sales/cuadres" : "/busy/sales/new";
	const backLabel = fromHistory || isReadOnly ? "Volver al historial" : "Volver al POS";

	const paymentData = data?.arqueo
		? [
				{
					name: "Efectivo CUP",
					value:
						(data.arqueo.totalEfectivoCup - data.turno.fondoInicialCup) / 100,
					fill: chartColors.cup,
				},
				{
					name: "Efectivo USD",
					value: data.arqueo.totalEfectivoUsd / 100,
					fill: chartColors.usd,
				},
				{
					name: "Efectivo USD",
					value: data.arqueo.totalEfectivoUsd / 100,
					fill: chartColors.usd,
				},
				{
					name: "Tarjeta",
					value: data.arqueo.totalTarjeta / 100,
					fill: chartColors.tarjeta,
				},
				{
					name: "Transferencia",
					value: data.arqueo.totalTransferencia / 100,
					fill: chartColors.transferencia,
				},
				{
					name: "Crédito",
					value: data.arqueo.totalCredito / 100,
					fill: chartColors.credito,
				},
			].filter((d) => d.value > 0)
		: [];

	const topProductos = [...(data?.productos ?? [])]
		.sort((a, b) => b.vendidoEnTurno - a.vendidoEnTurno)
		.slice(0, 10)
		.map((p) => ({
			name: p.nombre.length > 20 ? p.nombre.slice(0, 20) + "…" : p.nombre,
			vendido: p.vendidoEnTurno,
			ingreso: p.precioVenta,
		}));

	// ─── Loading ──────────────────────────────────────────────

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
				<Skeleton className="h-12 w-64" />
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-xl" />
					))}
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Skeleton className="h-72 rounded-xl" />
					<Skeleton className="h-72 rounded-xl" />
				</div>
				<Skeleton className="h-64 rounded-xl" />
			</div>
		);
	}

	// ─── Error ────────────────────────────────────────────────

	if (error || !data) {
		return (
			<div className="container mx-auto max-w-3xl py-16 px-4 text-center space-y-4">
				<AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
				<h2 className="text-xl font-semibold">Error al cargar cuadre</h2>
				<p className="text-muted-foreground">
					{error ?? "No se pudieron cargar los datos del turno"}
				</p>
				<Button
					variant="outline"
					onClick={() => router.push(backHref)}
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					{backLabel}
				</Button>
			</div>
		);
	}

	// ─── Loaded ───────────────────────────────────────────────

	return (
		<motion.div
			variants={containerVariants}
			initial="hidden"
			animate="show"
			className="container mx-auto max-w-6xl py-6 px-4 pb-24"
		>
			{/* Header */}
			<motion.div
				variants={itemVariants}
				className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
			>
				<div>
					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
						<Store className="h-4 w-4" />
						<span>{data.turno.puntoDeVentaNombre}</span>
						<span className="text-xs">·</span>
						<span>#{turnoId.slice(-6)}</span>
					</div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<TrendingUp className="h-6 w-6 text-primary" />
						Cuadre del Turno
					</h1>
				</div>

				<div className="flex items-center gap-2 self-end">
					{isReadOnly && <Badge variant="outline">Consulta histórica</Badge>}
					{data.turno.empleado && (
						<div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
							<User className="h-3.5 w-3.5" />
							{data.turno.empleado.nombre} {data.turno.empleado.apellido}
						</div>
					)}
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
						<DollarSign className="h-3.5 w-3.5" />
						Fondo: ${(data.turno.fondoInicialCup / 100).toFixed(2)}
					</div>
				</div>
			</motion.div>

			{/* Indicador de diferencia */}
			<motion.div variants={itemVariants} className="mb-6">
				<div
					className={cn(
						"rounded-xl border-2 p-4 flex items-start gap-3",
						tieneDiferencia
							? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
							: "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30",
					)}
				>
					{tieneDiferencia ? (
						<>
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", stiffness: 300 }}
							>
								<AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
							</motion.div>
							<div className="text-sm text-red-800 dark:text-red-300">
								<p className="font-semibold text-base">Diferencia detectada</p>
								<p className="mt-1">
									El arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>) no
									coincide con las ventas (
									<strong>${totalVenta.toFixed(2)}</strong>
									). Diferencia:{" "}
									<strong
										className={
											diferencia < 0 ? "text-red-600" : "text-amber-600"
										}
									>
										{diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}
									</strong>
								</p>
							</div>
						</>
					) : (
						<>
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
							>
								<CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
							</motion.div>
							<div className="text-sm text-green-800 dark:text-green-300">
								<p className="font-semibold text-base">Cuadre correcto</p>
								<p className="mt-1">
									Arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>)
									coincide con las ventas (
									<strong>${totalVenta.toFixed(2)}</strong>).
								</p>
							</div>
						</>
					)}
				</div>
			</motion.div>

			{/* Summary Cards - Bento Grid */}
			<motion.div
				variants={itemVariants}
				className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
			>
				{[
					{
						title: "Total Ventas",
						value: `$${totalVenta.toFixed(2)}`,
						icon: ShoppingCart,
						color:
							"text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
					},
					{
						title: "Arqueo CUP",
						value: `$${arqueoTotalCup.toFixed(2)}`,
						icon: Banknote,
						color:
							"text-green-600 bg-green-100 dark:bg-green-950 dark:text-green-400",
					},
					{
						title: "Diferencia",
						value: `${diferencia >= 0 ? "+" : ""}$${diferencia.toFixed(2)}`,
						icon: TrendingUp,
						color: tieneDiferencia
							? "text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400"
							: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
						highlight: tieneDiferencia,
					},
					{
						title: "Productos",
						value: `${data.resumen.totalVendido} vendidos`,
						icon: Package,
						color:
							"text-purple bg-purple/15 dark:bg-purple/25 dark:text-purple",
					},
				].map((card, i) => {
					const Icon = card.icon;
					return (
						<motion.div
							key={card.title}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
						>
							<Card
								className={cn(
									"overflow-hidden",
									card.highlight && "border-red-200 dark:border-red-800",
								)}
							>
								<CardContent className="p-4">
									<div className="flex items-start justify-between">
										<div>
											<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
												{card.title}
											</p>
											<p
												className={cn(
													"text-xl font-bold mt-1 tabular-nums",
													card.highlight && "text-red-600 dark:text-red-400",
												)}
											>
												{card.value}
											</p>
										</div>
										<div className={cn("rounded-lg p-2", card.color)}>
											<Icon className="h-4 w-4" />
										</div>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					);
				})}
			</motion.div>

			{/* Charts Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				{/* Pie Chart: Distribución de pagos */}
				<motion.div variants={itemVariants}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<Banknote className="h-4 w-4 text-muted-foreground" />
								Distribución por método de pago
							</CardTitle>
						</CardHeader>
						<CardContent>
							{paymentData.length > 0 ? (
								<ResponsiveContainer width="100%" height={260}>
									<PieChart>
										<Pie
											data={paymentData}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={90}
											paddingAngle={3}
											dataKey="value"
											animationBegin={300}
											animationDuration={800}
										>
											{paymentData.map((entry, idx) => (
												<Cell key={idx} fill={entry.fill} />
											))}
										</Pie>
										<Tooltip
											formatter={(value: number) => [
												`$${value.toFixed(2)}`,
												"Monto",
											]}
											contentStyle={{
												borderRadius: "8px",
												fontSize: "13px",
											}}
										/>
										<Legend
											formatter={(value: string) => (
												<span className="text-xs">{value}</span>
											)}
										/>
									</PieChart>
								</ResponsiveContainer>
							) : (
								<div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
									No hay datos de arqueo
								</div>
							)}
						</CardContent>
					</Card>
				</motion.div>

				{/* Bar Chart: Top productos */}
				<motion.div variants={itemVariants}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-muted-foreground" />
								Top productos vendidos
							</CardTitle>
						</CardHeader>
						<CardContent>
							{topProductos.length > 0 ? (
								<ResponsiveContainer width="100%" height={260}>
									<BarChart
										data={topProductos}
										layout="vertical"
										margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
										barCategoryGap="20%"
									>
										<CartesianGrid strokeDasharray="3 3" horizontal={false} />
										<XAxis type="number" tick={{ fontSize: 12 }} />
										<YAxis
											type="category"
											dataKey="name"
											width={120}
											tick={{ fontSize: 11 }}
										/>
										<Tooltip
											formatter={(value: number) => [value, "Vendido"]}
											contentStyle={{
												borderRadius: "8px",
												fontSize: "13px",
											}}
										/>
										<Bar
											dataKey="vendido"
											fill="#2563eb"
											radius={[0, 4, 4, 0]}
											animationBegin={400}
											animationDuration={600}
										/>
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
									No hay productos vendidos en este turno
								</div>
							)}
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Product Table */}
			<motion.div variants={itemVariants}>
				<CuadreDetailReadonlyNotice isReadOnly={Boolean(isReadOnly)} />
			</motion.div>

			<motion.div variants={itemVariants}>
				<Card>
					<CardHeader className="pb-2 border-b">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Package className="h-4 w-4 text-muted-foreground" />
							Productos del Turno
							<Badge className="ml-auto text-xs" variant="outline">
								{data.productos.length} productos
							</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<ScrollArea className="max-h-80">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-muted-foreground text-xs uppercase tracking-wider bg-muted/30">
										<th className="text-left px-4 py-2.5 font-medium">
											Producto
										</th>
										<th className="text-right px-4 py-2.5 font-medium">
											Stock
										</th>
										<th className="text-right px-4 py-2.5 font-medium">
											Vendido
										</th>
										<th className="text-right px-4 py-2.5 font-medium">
											Precio
										</th>
										<th className="text-right px-4 py-2.5 font-medium">
											Restante
										</th>
									</tr>
								</thead>
								<tbody>
									{data.productos.length === 0 ? (
										<tr>
											<td
												colSpan={5}
												className="px-4 py-8 text-center text-muted-foreground"
											>
												No hay productos en este turno
											</td>
										</tr>
									) : (
										data.productos.map((p) => (
											<tr
												key={p.id}
												className={cn(
													"border-b last:border-b-0 hover:bg-muted/30 transition-colors",
													tieneDiferencia && "text-red-700 dark:text-red-400",
												)}
											>
												<td className="px-4 py-2.5">
													<div className="flex items-center gap-2">
														{p.foto ? (
															/* eslint-disable-next-line @next/next/no-img-element */
															<img
																src={p.foto}
																alt={p.nombre}
																className="w-8 h-8 rounded object-cover bg-muted flex-shrink-0"
															/>
														) : (
															<div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
																<ImageIcon className="h-4 w-4 text-muted-foreground" />
															</div>
														)}
														<div className="min-w-0">
															<p className="font-medium truncate max-w-[180px]">
																{p.nombre}
															</p>
															{p.codigoInterno && (
																<p className="text-xs text-muted-foreground">
																	{p.codigoInterno}
																</p>
															)}
														</div>
													</div>
												</td>
												<td className="px-4 py-2.5 text-right tabular-nums">
													{p.stockEnUbicacion} {p.unidad ?? ""}
												</td>
												<td className="px-4 py-2.5 text-right tabular-nums font-medium">
													{p.vendidoEnTurno}
												</td>
												<td className="px-4 py-2.5 text-right tabular-nums">
													${p.precioVenta.toFixed(2)}
												</td>
												<td className="px-4 py-2.5 text-right tabular-nums">
													{p.restante} {p.unidad ?? ""}
												</td>
											</tr>
										))
									)}
								</tbody>
								{data.productos.length > 0 && (
									<tfoot>
										<tr className="border-t-2 bg-muted/50 font-semibold">
											<td className="px-4 py-3 text-sm">TOTAL</td>
											<td className="px-4 py-3 text-right tabular-nums">
												{data.resumen.totalStock}
											</td>
											<td className="px-4 py-3 text-right tabular-nums">
												{data.resumen.totalVendido}
											</td>
											<td className="px-4 py-3 text-right tabular-nums">
												${data.resumen.totalVentaMonto.toFixed(2)}
											</td>
											<td className="px-4 py-3 text-right tabular-nums">
												{data.resumen.totalStock}
											</td>
										</tr>
									</tfoot>
								)}
							</table>
						</ScrollArea>
					</CardContent>
				</Card>
			</motion.div>

			{/* Floating Footer */}
			<motion.div
				variants={itemVariants}
				className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 z-50"
			>
				<CuadreDetailActions
					backLabel={fromHistory || isReadOnly ? "Volver al historial" : "Cancelar"}
					isClosing={isClosing}
					isReadOnly={Boolean(isReadOnly)}
					onBack={() => router.push(backHref)}
					onCerrarTurno={handleCerrarTurno}
					onRepetirArqueo={handleRepetirArqueo}
					tieneDiferencia={tieneDiferencia}
				/>
			</motion.div>

			{/* Arqueo Dialog — Repetir Arqueo */}
			{isArqueoDialogOpen && (
				<ArqueoForm
					open={true}
					onOpenChange={() => setIsArqueoDialogOpen(false)}
					turnoId={turnoId}
					submitLabel="Continuar con el Cuadre"
					onSuccess={handleArqueoSuccess}
				/>
			)}
		</motion.div>
	);
}
