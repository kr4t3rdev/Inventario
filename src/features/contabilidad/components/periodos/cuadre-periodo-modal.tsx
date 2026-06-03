/**
 * @description Modal de pantalla completa que muestra el cuadre contable
 * de un período antes de confirmar su cierre.
 *
 * Contiene 4 tabs: Balance, Ventas vs Reconciliado, Operaciones, Resumen Diario.
 * Al confirmar, ejecuta cerrarPeriodoAction. Si falla, muestra el error sin cerrarse.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { BalanceTab } from "./balance-tab";
import { VentasVsReconciliadoTab } from "./ventas-vs-reconciliado-tab";
import { OperacionesTab } from "./operaciones-tab";
import { ResumenDiarioTab } from "./resumen-diario-tab";

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

interface CuadrePeriodoModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	periodoId: string;
}

const TIPO_LABELS: Record<string, string> = {
	DIARIO: "Diario",
	MENSUAL: "Mensual",
	TRIMESTRAL: "Trimestral",
	SEMESTRAL: "Semestral",
	ANUAL: "Anual",
};

export function CuadrePeriodoModal({
	open,
	onOpenChange,
	onSuccess,
	periodoId,
}: CuadrePeriodoModalProps) {
	const [data, setData] = useState<CuadreData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("balance");

	// Cargar datos al abrir
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
		if (open) {
			setData(null);
			setActiveTab("balance");
			setError(null);
			loadData();
		}
	}, [open, loadData]);

	// Paginación de ventas
	const handlePageVentas = useCallback(
		(page: number) => {
			loadData({ pageVentas: page });
		},
		[loadData],
	);

	// Paginación + filtro de operaciones
	const [filtroOperacion, setFiltroOperacion] = useState("todas");
	const handlePageOperaciones = useCallback(
		(page: number) => {
			loadData({ pageOperaciones: page, filtroOperacion });
		},
		[loadData, filtroOperacion],
	);
	const handleFiltroOperacion = useCallback(
		(filtro: string) => {
			setFiltroOperacion(filtro);
			loadData({ pageOperaciones: 1, filtroOperacion: filtro });
		},
		[loadData],
	);

	// Lazy loading de detalle diario (solo si no vino completo en la carga inicial)
	const handleLoadDia = useCallback(
		async (fecha: string): Promise<OperacionItem[]> => {
			const { obtenerOperacionesDiaAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await obtenerOperacionesDiaAction({
				periodoId,
				fecha,
			});
			if (result.success && result.data) {
				return result.data as OperacionItem[];
			}
			return [];
		},
		[periodoId],
	);

	// Confirmar cierre
	const handleConfirmar = async () => {
		if (!data) return;
		setIsSubmitting(true);
		setError(null);
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
			onSuccess();
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error inesperado");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
				{/* Header */}
				<DialogHeader className="px-6 pt-6 pb-2 border-b shrink-0">
					<div className="flex items-center justify-between">
						<div>
							<DialogTitle className="text-lg">Cuadre del Período</DialogTitle>
							{data && (
								<p className="text-sm text-muted-foreground mt-1">
									{data.periodo.codigo ?? "Sin código"} —{" "}
									<Badge variant="outline" className="text-xs">
										{TIPO_LABELS[data.periodo.tipo] ?? data.periodo.tipo}
									</Badge>{" "}
									{format(new Date(data.periodo.fechaInicio), "d MMM yyyy", {
										locale: es,
									})}{" "}
									—{" "}
									{format(new Date(data.periodo.fechaFin), "d MMM yyyy", {
										locale: es,
									})}
								</p>
							)}
						</div>
						{data?.periodo.modoContable && (
							<Badge variant="secondary">
								{data.periodo.modoContable === "CAJA"
									? "Base Caja"
									: "Base Devengo"}
							</Badge>
						)}
					</div>
				</DialogHeader>

				{/* Estado de carga */}
				{isLoading && (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
							<p className="text-sm text-muted-foreground">
								Cargando cuadre del período...
							</p>
						</div>
					</div>
				)}

				{/* Error de carga */}
				{!isLoading && error && !data && (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center max-w-md">
							<XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
							<p className="text-sm text-destructive font-medium mb-2">
								Error al cargar el cuadre
							</p>
							<p className="text-sm text-muted-foreground mb-4">{error}</p>
							<div className="flex gap-2 justify-center">
								<Button variant="outline" onClick={() => onOpenChange(false)}>
									Cerrar
								</Button>
								<Button onClick={() => loadData()}>Reintentar</Button>
							</div>
						</div>
					</div>
				)}

				{/* Contenido del cuadre */}
				{!isLoading && data && (
					<>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="flex-1 flex flex-col min-h-0"
						>
							<div className="px-6 pt-3 shrink-0">
								<TabsList>
									<TabsTrigger value="balance">Balance</TabsTrigger>
									<TabsTrigger value="ventas">
										Ventas vs Reconciliado
									</TabsTrigger>
									<TabsTrigger value="operaciones">Operaciones</TabsTrigger>
									<TabsTrigger value="diario">Resumen Diario</TabsTrigger>
								</TabsList>
							</div>

							<div className="flex-1 overflow-y-auto px-6 py-4">
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

						{/* Footer */}
						<div className="border-t px-6 py-4 shrink-0">
							<div className="flex items-center justify-between">
								{error && (
									<div className="flex items-center gap-2 text-sm text-destructive">
										<AlertTriangle className="h-4 w-4" />
										{error}
									</div>
								)}
								{!error && <div />}
								<div className="flex gap-2 ml-auto">
									<Button variant="outline" onClick={() => onOpenChange(false)}>
										Cancelar
									</Button>
									<Button onClick={handleConfirmar} disabled={isSubmitting}>
										{isSubmitting && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Confirmar Cierre
									</Button>
								</div>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
