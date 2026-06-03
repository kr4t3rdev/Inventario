/**
 * @description Componente cliente de la página de cuadre de período.
 * Muestra resumen financiero con gráficos, tabs detallados y acción de cierre.
 * Valida operaciones pendientes antes de cerrar.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	XCircle,
	ArrowLeft,
	Lock,
	BarChart3,
	TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { BalanceTab } from "../periodos/balance-tab";
import { VentasVsReconciliadoTab } from "../periodos/ventas-vs-reconciliado-tab";
import { OperacionesTab } from "../periodos/operaciones-tab";
import { ResumenDiarioTab } from "../periodos/resumen-diario-tab";
import { BalancePieChart } from "./balance-pie-chart";
import { DailyTrendChart } from "./daily-trend-chart";

import type {
	BalanceData,
	VentasVsReconciliadoData,
	ResumenDiarioItem,
	OperacionesData,
	OperacionItem,
} from "../../cuadre-queries";

interface CuadreData {
	periodo: {
		periodoId: string;
		codigo: string | null;
		tipo: string;
		estado: string;
		modoContable: string | null;
		fechaInicio: string;
		fechaFin: string;
		abiertoPorId: string | null;
		fechaApertura: string | null;
	};
	balance: BalanceData;
	ventasVsReconciliado: VentasVsReconciliadoData;
	resumenDiario: ResumenDiarioItem[];
	operaciones: OperacionesData;
}

interface CuadrePeriodoPageClientProps {
	periodoId: string;
	initialPeriodo: {
		periodoId: string;
		codigo: string | null;
		tipo: string;
		estado: string;
		modoContable: string | null;
		fechaInicio: string;
		fechaFin: string;
	};
}

const TIPO_LABELS: Record<string, string> = {
	DIARIO: "Diario",
	MENSUAL: "Mensual",
	TRIMESTRAL: "Trimestral",
	SEMESTRAL: "Semestral",
	ANUAL: "Anual",
};

const ESTADO_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	ABIERTO: "default",
	REABIERTO: "secondary",
};

export function CuadrePeriodoPageClient({
	periodoId,
	initialPeriodo,
}: CuadrePeriodoPageClientProps) {
	const router = useRouter();
	const [data, setData] = useState<CuadreData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isClosing, setIsClosing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("balance");
	const [filtroOperacion, setFiltroOperacion] = useState("todas");

	// Cargar datos del cuadre
	const loadData = useCallback(
		async (overrides?: {
			pageVentas?: number;
			pageOperaciones?: number;
			filtroOperacion?: string;
		}) => {
			setIsLoading(true);
			setError(null);
			try {
				const { obtenerCuadrePeriodoAction } = await import(
					"@/features/contabilidad/actions-periodos"
				);
				const result = await obtenerCuadrePeriodoAction({
					periodoId,
					pageVentas: overrides?.pageVentas ?? 1,
					pageOperaciones: overrides?.pageOperaciones ?? 1,
					filtroOperacion: overrides?.filtroOperacion ?? "todas",
				});
				if (!result.success) {
					setError(result.error?.message ?? "Error al cargar cuadre");
				} else {
					setData(result.data as CuadreData);
				}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Error inesperado al cargar",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[periodoId],
	);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Paginación ventas
	const handlePageVentas = useCallback(
		(page: number) => loadData({ pageVentas: page }),
		[loadData],
	);

	// Paginación + filtro operaciones
	const handlePageOperaciones = useCallback(
		(page: number) => loadData({ pageOperaciones: page, filtroOperacion }),
		[loadData, filtroOperacion],
	);

	const handleFiltroOperacion = useCallback(
		(filtro: string) => {
			setFiltroOperacion(filtro);
			loadData({ pageOperaciones: 1, filtroOperacion: filtro });
		},
		[loadData],
	);

	// Lazy loading detalle diario
	const handleLoadDia = useCallback(
		async (fecha: string): Promise<OperacionItem[]> => {
			const { obtenerOperacionesDiaAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await obtenerOperacionesDiaAction({ periodoId, fecha });
			return result.success && result.data
				? (result.data as OperacionItem[])
				: [];
		},
		[periodoId],
	);

	// ── Validación de operaciones pendientes ──
	const verificarOperacionesPendientes = useCallback(async (): Promise<
		string | null
	> => {
		try {
			const { verificarOperacionesPendientesAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await verificarOperacionesPendientesAction(periodoId);
			if (!result.success) return "Error al verificar operaciones pendientes";
			const pendientes = result.data as {
				ventasSinReconciliar: number;
				serviciosSinReconciliar: number;
				gastosSinReconciliar: number;
			};
			if (
				pendientes.ventasSinReconciliar > 0 ||
				pendientes.serviciosSinReconciliar > 0 ||
				pendientes.gastosSinReconciliar > 0
			) {
				const partes: string[] = [];
				if (pendientes.ventasSinReconciliar > 0)
					partes.push(
						`${pendientes.ventasSinReconciliar} venta(s) sin reconciliar`,
					);
				if (pendientes.serviciosSinReconciliar > 0)
					partes.push(
						`${pendientes.serviciosSinReconciliar} servicio(s) sin reconciliar`,
					);
				if (pendientes.gastosSinReconciliar > 0)
					partes.push(
						`${pendientes.gastosSinReconciliar} gasto(s) sin reconciliar`,
					);
				return `No se puede cerrar el período. Quedan ${partes.join(", ")}.`;
			}
			return null;
		} catch {
			return "Error al verificar operaciones pendientes";
		}
	}, [periodoId]);

	// Confirmar cierre
	const handleCerrar = async () => {
		setIsClosing(true);
		setError(null);

		// Primero verificar pendientes
		const pendientesError = await verificarOperacionesPendientes();
		if (pendientesError) {
			setError(pendientesError);
			setIsClosing(false);
			return;
		}

		if (!data) {
			setIsClosing(false);
			return;
		}

		try {
			const { cerrarPeriodoAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await cerrarPeriodoAction({
				periodoId: data.periodo.periodoId,
			});
			if (!result.success) {
				setError(result.error?.message ?? "Error al cerrar período");
				return;
			}
			router.push("/busy/contabilidad/periodos");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error inesperado");
		} finally {
			setIsClosing(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* ── Header ── */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => router.push("/busy/contabilidad/periodos")}
					>
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-semibold">Cuadre del Período</h1>
							{initialPeriodo.estado === "REABIERTO" && (
								<Badge variant="secondary">Reabierto</Badge>
							)}
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							{initialPeriodo.codigo ?? "Sin código"} —{" "}
							<Badge variant="outline" className="text-xs">
								{TIPO_LABELS[initialPeriodo.tipo] ?? initialPeriodo.tipo}
							</Badge>{" "}
							{format(new Date(initialPeriodo.fechaInicio), "d MMM yyyy", {
								locale: es,
							})}{" "}
							—{" "}
							{format(new Date(initialPeriodo.fechaFin), "d MMM yyyy", {
								locale: es,
							})}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{initialPeriodo.modoContable && (
						<Badge variant="secondary">
							{initialPeriodo.modoContable === "CAJA"
								? "Base Caja"
								: "Base Devengo"}
						</Badge>
					)}
				</div>
			</div>

			{/* ── Loading ── */}
			{isLoading && (
				<div className="flex items-center justify-center py-24">
					<div className="text-center">
						<Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
						<p className="text-sm text-muted-foreground">
							Cargando cuadre del período...
						</p>
					</div>
				</div>
			)}

			{/* ── Error ── */}
			{!isLoading && error && !data && (
				<div className="flex items-center justify-center py-24">
					<div className="text-center max-w-md">
						<XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
						<p className="text-lg font-medium text-destructive mb-2">
							Error al cargar el cuadre
						</p>
						<p className="text-sm text-muted-foreground mb-6">{error}</p>
						<div className="flex gap-3 justify-center">
							<Button
								variant="outline"
								onClick={() => router.push("/busy/contabilidad/periodos")}
							>
								Volver
							</Button>
							<Button onClick={() => loadData()}>Reintentar</Button>
						</div>
					</div>
				</div>
			)}

			{/* ── Content ── */}
			{!isLoading && data && (
				<>
					{/* Charts row */}
					<div className="grid gap-6 md:grid-cols-2">
						<BalancePieChart saldosPorCuenta={data.balance.saldosPorCuenta} />
						<DailyTrendChart data={data.resumenDiario} />
					</div>

					{/* Tabs */}
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<TabsList>
							<TabsTrigger value="balance">Balance</TabsTrigger>
							<TabsTrigger value="ventas">Ventas, Serv. y Gastos vs Reconc.</TabsTrigger>
							<TabsTrigger value="operaciones">Operaciones</TabsTrigger>
							<TabsTrigger value="diario">Resumen Diario</TabsTrigger>
						</TabsList>

						<div className="pt-4">
							<TabsContent value="balance" className="mt-0">
								<BalanceTab
									saldosPorCuenta={data.balance.saldosPorCuenta}
									totalesPorMoneda={data.balance.totalesPorMoneda}
								/>
							</TabsContent>

							<TabsContent value="ventas" className="mt-0">
								<VentasVsReconciliadoTab
									data={data.ventasVsReconciliado}
									onPageChange={handlePageVentas}
								/>
							</TabsContent>

							<TabsContent value="operaciones" className="mt-0">
								<OperacionesTab
									data={data.operaciones}
									onPageChange={handlePageOperaciones}
									onFiltroChange={handleFiltroOperacion}
									filtroActivo={filtroOperacion}
								/>
							</TabsContent>

							<TabsContent value="diario" className="mt-0">
								<ResumenDiarioTab
									items={data.resumenDiario}
									onLoadDia={handleLoadDia}
								/>
							</TabsContent>
						</div>
					</Tabs>

					{/* Error bar (in-page errors, e.g. close validation) */}
					{error && (
						<div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
							<AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
							<div className="text-sm text-destructive">{error}</div>
						</div>
					)}

					{/* Action bar */}
					<div className="flex items-center justify-between border-t pt-6">
						<Button
							variant="outline"
							onClick={() => router.push("/busy/contabilidad/periodos")}
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Volver a Períodos
						</Button>
						<div className="flex items-center gap-3">
							<span className="text-xs text-muted-foreground flex items-center gap-1">
								<Lock className="h-3 w-3" />
								Al cerrar se genera un snapshot contable
							</span>
							<Button onClick={handleCerrar} disabled={isClosing} size="lg">
								{isClosing ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<CheckCircle2 className="h-4 w-4 mr-2" />
								)}
								Cerrar Período
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
