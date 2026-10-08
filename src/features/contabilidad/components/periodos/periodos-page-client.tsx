/**
 * @description Componente cliente principal para gestión de períodos contables.
 * Gestiona la lista, filtros, acciones y diálogos de períodos.
 *
 * @param {Object} props - Props del componente.
 * @param {Array} props.initialPeriodos - Lista inicial de períodos del server.
 * @param {Object} props.initialPagination - Información de paginación.
 */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Loader2,
	Plus,
	Calendar,
	Lock,
	CheckCircle,
	ShieldCheck,
	ShieldAlert,
	AlertCircle,
	Info,
} from "lucide-react";
import { format } from "date-fns";
import { PeriodoTimeline } from "./periodo-timeline";
import { PeriodosDashboard } from "./periodos-dashboard";
import { PeriodoBadge } from "./periodo-badge";
import { AbrirPeriodoDialog } from "./abrir-periodo-dialog";
import { CerrarPeriodoDialog } from "./cerrar-periodo-dialog";
import { ReabrirPeriodoDialog } from "./reabrir-periodo-dialog";
import type {
	TipoPeriodo,
	EstadoPeriodo,
} from "@/lib/services/periodo-contable-types";

interface ManualAperturaLineDraft {
	role: string;
	accountId: string;
	label: string;
	side: "DEBE" | "HABER";
	amount: string;
	reference: string;
	note: string;
}

interface ManualAperturaDraftInput {
	periodoId: string;
	aperturaId: string;
	fechaCorte: string | Date;
	lines: ManualAperturaLineDraft[];
}

/**
 * @description Converts explicit user declarations into manual CUP evidence; it never asserts source trust.
 * @param {ManualAperturaDraftInput} input - Period, opening, and user-declared line data.
 * @returns {Object} Action payload with manual evidence snapshots and no actor or tenant identity.
 */
export function buildManualAperturaDraftInput(input: ManualAperturaDraftInput) {
	return {
		periodoId: input.periodoId,
		aperturaId: input.aperturaId,
		fechaCorte: input.fechaCorte instanceof Date ? input.fechaCorte : new Date(input.fechaCorte),
		lines: input.lines.map((line) => ({
			fechaEfectiva: input.fechaCorte instanceof Date ? input.fechaCorte : new Date(input.fechaCorte),
			lado: line.side,
			rolCuenta: line.role,
			cuentaId: line.accountId,
			monedaNativa: "CUP" as const,
			importeNativo: line.amount,
			importeFuncional: line.amount,
			fuenteTipo: "MANUAL" as const,
			fuenteId: line.reference,
			evidenciaVersion: 1,
			fuenteSnapshot: {
				declaredSource: "MANUAL_USER_DECLARATION",
				accountLabel: line.label,
				role: line.role,
				side: line.side,
				currency: "CUP",
				amount: line.amount,
				reference: line.reference,
				note: line.note,
			},
		})),
	};
}

/** @description Allows a first or rejected-correction draft, but never replaces an approved opening. */
export function canCreateManualAperturaDraft(latestStatus?: string): boolean {
	return latestStatus === undefined || latestStatus === "RECHAZADA";
}

/** @description Guards async context responses against a newer request or period selection. */
export function isCurrentAperturaContext(
	requestId: number,
	latestRequestId: number,
	requestedPeriodId: string,
	selectedPeriodId: string | null,
): boolean {
	return requestId === latestRequestId && requestedPeriodId === selectedPeriodId;
}

const TIPO_LABELS: Record<string, string> = {
	DIARIO: "Diario",
	MENSUAL: "Mensual",
	TRIMESTRAL: "Trimestral",
	SEMESTRAL: "Semestral",
	ANUAL: "Anual",
};

const CATEGORIA_LABELS: Record<string, string> = {
	ORDINARIO: "Ordinario",
	EXTRAORDINARIO: "Extraordinario",
	RECTIFICATIVO: "Rectificativo",
};

const CATEGORIA_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive" | null
> = {
	ORDINARIO: "secondary",
	EXTRAORDINARIO: "outline",
	RECTIFICATIVO: "destructive",
};

const MODO_LABELS: Record<string, string> = {
	CAJA: "Base Caja",
	DEVENGO: "Base Devengo",
};

const MODO_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive" | null
> = {
	CAJA: "default",
	DEVENGO: "secondary",
};

export function PeriodosPageClient({
	initialPeriodos = [],
	initialPagination = null,
}: {
	initialPeriodos: any[];
	initialPagination: any;
}) {
	const router = useRouter();
	// Data state
	const [periodos, setPeriodos] = useState(initialPeriodos);
	const [pagination] = useState(initialPagination);
	const [isLoading, setIsLoading] = useState(false);
	const [timelineData, setTimelineData] = useState<Record<string, any[]>>({});
	const [aperturaPeriodoId, setAperturaPeriodoId] = useState<string | null>(null);
	const [aperturaContext, setAperturaContext] = useState<any>(null);
	const [aperturaContextPeriodId, setAperturaContextPeriodId] = useState<string | null>(null);
	const [aperturaRevisionDetail, setAperturaRevisionDetail] = useState<any>(null);
	const [aperturaLines, setAperturaLines] = useState<ManualAperturaLineDraft[]>([]);
	const [aperturaBusy, setAperturaBusy] = useState(false);
	const aperturaRequestId = useRef(0);
	const aperturaPeriodoIdRef = useRef<string | null>(null);

	// View mode
	const [viewMode, setViewMode] = useState<"list" | "dashboard">("list");

	// Filters
	const [filtroTipo, setFiltroTipo] = useState<string>("todos");
	const [filtroEstado, setFiltroEstado] = useState<string>("todos");

	// Dialogs
	const [showAbrirDialog, setShowAbrirDialog] = useState(false);
	const [showCerrarDialog, setShowCerrarDialog] = useState(false);
	const [showReabrirDialog, setShowReabrirDialog] = useState(false);
	const [showAprobarDialog, setShowAprobarDialog] = useState(false);
	const [periodoSeleccionado, setPeriodoSeleccionado] = useState<any>(null);

	// Timeline
	const [timelinePeriodoId, setTimelinePeriodoId] = useState<string | null>(
		null,
	);

	// Refresh handler
	const refreshPeriodos = useCallback(async () => {
		setIsLoading(true);
		try {
			const { listarPeriodosAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const filtro: Record<string, any> = { limit: 100 };
			if (filtroTipo !== "todos") filtro.tipo = filtroTipo;
			if (filtroEstado !== "todos") filtro.estado = filtroEstado;

			const result = await listarPeriodosAction(filtro);
			if (result.success && result.data) {
				setPeriodos(result.data.periodos ?? []);
			}
		} catch (err) {
			console.error("Error refreshing periodos:", err);
		} finally {
			setIsLoading(false);
		}
	}, [filtroTipo, filtroEstado]);

	// Load timeline for a periodo
	const loadTimeline = useCallback(async (periodoId: string) => {
		try {
			const { obtenerTimelineAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await obtenerTimelineAction(periodoId);
			if (result.success && result.data) {
				setTimelineData((prev) => ({
					...prev,
					[periodoId]: result.data?.timeline ?? [],
				}));
			}
		} catch (err) {
			console.error("Error loading timeline:", err);
		}
	}, []);

	// Load timeline when selecting a periodo for detail
	useEffect(() => {
		if (timelinePeriodoId && !timelineData[timelinePeriodoId]) {
			loadTimeline(timelinePeriodoId);
		}
	}, [timelinePeriodoId, loadTimeline, timelineData]);

	// Filter logic
	const periodosFiltrados = periodos.filter((p) => {
		if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
		if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
		return true;
	});

	// Action handlers
	const handleCerrar = (periodo: any) => {
		setPeriodoSeleccionado(periodo);
		setShowCerrarDialog(true);
	};

	const handleReabrir = (periodo: any) => {
		setPeriodoSeleccionado(periodo);
		setShowReabrirDialog(true);
	};

	const handleAprobar = async (periodo: any) => {
		try {
			const { aprobarPeriodoAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await aprobarPeriodoAction({
				periodoId: periodo.periodoId,
			});
			if (!result.success) {
				toast.error(result.error?.message ?? "Error al aprobar");
				return;
			}
			toast.success("Período aprobado correctamente");
			refreshPeriodos();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Error al aprobar");
		}
	};

	const handleTimelineClick = (periodoId: string) => {
		setTimelinePeriodoId(timelinePeriodoId === periodoId ? null : periodoId);
	};

	const loadAperturaContext = async (periodoId: string) => {
		const requestId = ++aperturaRequestId.current;
		aperturaPeriodoIdRef.current = periodoId;
		setAperturaPeriodoId(periodoId);
		setAperturaContext(null);
		setAperturaContextPeriodId(null);
		setAperturaRevisionDetail(null);
		setAperturaLines([]);
		try {
			const { getAperturaRevisionContextAction, getAperturaRevisionAction } = await import(
				"@/features/contabilidad/actions-apertura-revisada"
			);
			const result = await getAperturaRevisionContextAction(periodoId);
			if (!isCurrentAperturaContext(requestId, aperturaRequestId.current, periodoId, aperturaPeriodoIdRef.current)) return;
			if (!result.success || !result.data) {
				toast.error("error" in result ? result.error?.message ?? "No se pudo cargar la apertura revisada" : "No se pudo cargar la apertura revisada");
				return;
			}
			setAperturaContext(result.data);
			setAperturaContextPeriodId(periodoId);
			const latest = result.data.revisiones?.[0];
			if (latest) {
				const detail = await getAperturaRevisionAction(latest.revisionId);
				if (!isCurrentAperturaContext(requestId, aperturaRequestId.current, periodoId, aperturaPeriodoIdRef.current)) return;
				if (detail.success) setAperturaRevisionDetail(detail.data?.revision ?? null);
			}
		} catch (error) {
			if (isCurrentAperturaContext(requestId, aperturaRequestId.current, periodoId, aperturaPeriodoIdRef.current)) {
				toast.error(error instanceof Error ? error.message : "No se pudo cargar la apertura revisada");
			}
		}
	};

	const closeAperturaContext = () => {
		aperturaRequestId.current += 1;
		aperturaPeriodoIdRef.current = null;
		setAperturaPeriodoId(null);
		setAperturaContextPeriodId(null);
		setAperturaContext(null);
		setAperturaRevisionDetail(null);
	};

	const handleCreateAperturaDraft = async () => {
		if (!aperturaPeriodoId || aperturaContextPeriodId !== aperturaPeriodoId ||
			!aperturaContext?.apertura || aperturaLines.length === 0) return;
		const hasInvalidLine = aperturaLines.some((line) =>
			!line.reference.trim() || !line.note.trim() ||
			!/^\d+(\.\d{1,4})?$/.test(line.amount) || Number(line.amount) <= 0 ||
			!aperturaContext.roles.some((role: any) =>
				role.role === line.role && role.accountId === line.accountId));
		const hasDuplicateAccount = new Set(aperturaLines.map((line) => line.accountId)).size !== aperturaLines.length;
		if (hasInvalidLine || hasDuplicateAccount) {
			toast.error(hasDuplicateAccount
				? "Cada cuenta debe aparecer una sola vez en la apertura."
				: "Completa cada línea con una cuenta disponible, importe CUP positivo, referencia y nota.");
			return;
		}
		setAperturaBusy(true);
		try {
			const { createAperturaRevisionDraftAction } = await import(
				"@/features/contabilidad/actions-apertura-revisada"
			);
			const result = await createAperturaRevisionDraftAction(buildManualAperturaDraftInput({
				periodoId: aperturaPeriodoId,
				aperturaId: aperturaContext.apertura.aperturaId,
				fechaCorte: new Date(aperturaContext.apertura.fechaCorte).toISOString(),
				lines: aperturaLines,
			}));
			if (!result.success) {
				toast.error("error" in result ? result.error?.message ?? "No se pudo guardar el borrador" : "No se pudo guardar el borrador");
				return;
			}
			toast.success("Borrador manual guardado; la evidencia declarada requiere revisión");
			if (aperturaPeriodoIdRef.current === aperturaPeriodoId) await loadAperturaContext(aperturaPeriodoId);
			refreshPeriodos();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo guardar el borrador");
		} finally {
			setAperturaBusy(false);
		}
	};

	const handleAperturaRevisionAction = async (kind: "submit" | "approve") => {
		if (!aperturaPeriodoId || aperturaContextPeriodId !== aperturaPeriodoId) return;
		const revisionId = aperturaContext?.revisiones?.[0]?.revisionId;
		if (!revisionId) return;
		setAperturaBusy(true);
		try {
			const actions = await import("@/features/contabilidad/actions-apertura-revisada");
			const result = kind === "submit"
				? await actions.submitAperturaRevisionAction(revisionId)
				: await actions.approveAperturaRevisionAction(revisionId);
			if (!result.success) {
				toast.error("error" in result ? result.error?.message ?? "No se pudo completar la revisión" : "No se pudo completar la revisión");
				return;
			}
			toast.success(kind === "submit" ? "Revisión presentada" : "Apertura aprobada");
			if (aperturaPeriodoIdRef.current === aperturaPeriodoId) await loadAperturaContext(aperturaPeriodoId);
			refreshPeriodos();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo completar la revisión");
		} finally {
			setAperturaBusy(false);
		}
	};

	// Helper: qué acciones están disponibles según estado
	const getAcciones = (periodo: any) => {
		const acciones: {
			label: string;
			action: () => void;
			variant?: "default" | "outline" | "destructive";
		}[] = [];

		switch (periodo.estado) {
			case "ABIERTO":
			case "REABIERTO":
				acciones.push({
					label: "Ver Cuadre",
					action: () => router.push(`/busy/contabilidad/periodos/${periodo.periodoId}/cuadre`),
				});
				acciones.push({
					label: "Cerrar",
					action: () => handleCerrar(periodo),
					variant: "outline",
				});
				break;
			case "CERRADO":
				acciones.push({
					label: "Aprobar",
					action: () => handleAprobar(periodo),
				});
				acciones.push({
					label: "Reabrir",
					action: () => handleReabrir(periodo),
					variant: "outline",
				});
				break;
			case "APROBADO":
				acciones.push({
					label: "Reabrir",
					action: () => handleReabrir(periodo),
					variant: "outline",
				});
				break;
		}

		return acciones;
	};

	const periodoTimeline = timelinePeriodoId
		? (timelineData[timelinePeriodoId] ?? [])
		: [];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-semibold">Períodos Contables</h2>
					<p className="text-muted-foreground">
						Gestión de períodos diarios, mensuales y anuales con control de
						cierres y auditoría.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border overflow-hidden">
						<button
							type="button"
							className={`px-3 py-1.5 text-xs font-medium transition-colors ${
								viewMode === "list"
									? "bg-primary text-primary-foreground"
									: "bg-background text-muted-foreground hover:bg-muted"
							}`}
							onClick={() => setViewMode("list")}
						>
							Listado
						</button>
						<button
							type="button"
							className={`px-3 py-1.5 text-xs font-medium transition-colors ${
								viewMode === "dashboard"
									? "bg-primary text-primary-foreground"
									: "bg-background text-muted-foreground hover:bg-muted"
							}`}
							onClick={() => setViewMode("dashboard")}
						>
							Dashboard
						</button>
					</div>
					<Button onClick={() => setShowAbrirDialog(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Nuevo Período
					</Button>
				</div>
			</div>

			{/* Dashboard View */}
			{viewMode === "dashboard" && <PeriodosDashboard />}

			{/* List View */}
			{viewMode === "list" && (
				<>
					{/* Filters */}
					<Card>
						<CardContent className="pt-6">
							<div className="flex gap-4 flex-wrap">
								<div className="space-y-1">
									<label className="text-xs text-muted-foreground">Tipo</label>
									<Select value={filtroTipo} onValueChange={setFiltroTipo}>
										<SelectTrigger className="w-[140px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="todos">Todos</SelectItem>
											<SelectItem value="DIARIO">Diario</SelectItem>
											<SelectItem value="MENSUAL">Mensual</SelectItem>
											<SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
											<SelectItem value="SEMESTRAL">Semestral</SelectItem>
											<SelectItem value="ANUAL">Anual</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1">
									<label className="text-xs text-muted-foreground">
										Estado
									</label>
									<Select value={filtroEstado} onValueChange={setFiltroEstado}>
										<SelectTrigger className="w-[140px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="todos">Todos</SelectItem>
											<SelectItem value="ABIERTO">Abierto</SelectItem>
											<SelectItem value="CERRADO">Cerrado</SelectItem>
											<SelectItem value="APROBADO">Aprobado</SelectItem>
											<SelectItem value="REABIERTO">Reabierto</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Table */}
					<Card>
						<CardHeader>
							<CardTitle>Períodos</CardTitle>
							<CardDescription>
								{periodosFiltrados.length} período
								{periodosFiltrados.length !== 1 ? "s" : ""} encontrado
								{periodosFiltrados.length !== 1 ? "s" : ""}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : periodosFiltrados.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Calendar className="mx-auto h-12 w-12 mb-4" />
									<p>No hay períodos registrados</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Código</TableHead>
											<TableHead>Tipo</TableHead>
											<TableHead>Período</TableHead>
											<TableHead>Estado</TableHead>
											<TableHead>Integridad</TableHead>
											<TableHead>Última Acción</TableHead>
											<TableHead>Acciones</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{periodosFiltrados.map((periodo) => (
											<React.Fragment key={periodo.periodoId}>
												<TableRow>
													<TableCell>
														<span className="font-mono text-sm font-medium">
															{periodo.codigo ?? "—"}
														</span>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-1.5">
															<Badge variant="outline">
																{TIPO_LABELS[periodo.tipo] ?? periodo.tipo}
															</Badge>
															{periodo.categoria &&
																periodo.categoria !== "ORDINARIO" && (
																	<Badge
																		variant={
																			CATEGORIA_VARIANTS[periodo.categoria] ??
																			"outline"
																		}
																	>
																		{CATEGORIA_LABELS[periodo.categoria] ??
																			periodo.categoria}
																	</Badge>
																)}
															{periodo.modoContable &&
																periodo.modoContable !== "CAJA" && (
																	<Badge
																		variant={
																			MODO_VARIANTS[periodo.modoContable] ??
																			"default"
																		}
																	>
																		{MODO_LABELS[periodo.modoContable] ??
																			periodo.modoContable}
																	</Badge>
																)}
														</div>
													</TableCell>
													<TableCell>
														<div className="text-sm">
															{format(
																new Date(periodo.fechaInicio),
																"dd/MM/yyyy",
															)}
															<span className="text-muted-foreground"> — </span>
															{format(new Date(periodo.fechaFin), "dd/MM/yyyy")}
														</div>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<PeriodoBadge estado={periodo.estado} />
															{periodo.subperiodosCount > 0 && (
																<span
																	className="text-xs text-muted-foreground"
																	title="Tiene subperíodos"
																>
																	{periodo.subperiodosCount} sub
																</span>
															)}
															{periodo.blockers?.length > 0 && (
																<span title={periodo.blockers.join("; ")}>
																	<AlertCircle className="h-4 w-4 text-destructive" />
																</span>
															)}
														</div>
													</TableCell>
													<TableCell>
														{periodo.tieneHash ? (
															<span
																title="Hash de integridad presente"
																className="text-green-600 flex items-center gap-1"
															>
																<ShieldCheck className="h-4 w-4" />
																<span className="text-xs">Verificado</span>
															</span>
														) : (
															<span
																title="Sin hash de integridad"
																className="text-muted-foreground flex items-center gap-1"
															>
																<ShieldAlert className="h-4 w-4" />
																<span className="text-xs">Pendiente</span>
															</span>
														)}
													</TableCell>
													<TableCell>
														<span className="text-xs text-muted-foreground">
															{periodo.ultimaAuditoria ? (
																<span
																	className="flex items-center gap-1"
																	title={`Por ${periodo.ultimaAuditoria.actor}`}
																>
																	<Info className="h-3 w-3" />
																	{periodo.ultimaAuditoria.evento}
																</span>
															) : (
																"-"
															)}
														</span>
													</TableCell>
													<TableCell>
														<div className="flex gap-2 items-center">
															{getAcciones(periodo).map((accion, idx) => (
																<Button
																	key={idx}
																	variant={accion.variant ?? "default"}
																	size="sm"
																	onClick={accion.action}
																>
																	{accion.label}
																</Button>
															))}
																				<Button
																				variant="ghost"
																				size="sm"
																onClick={() =>
																	handleTimelineClick(periodo.periodoId)
																}
															>
																{timelinePeriodoId === periodo.periodoId
																	? "Ocultar"
																					: "Timeline"}
																				</Button>
																				<Button
																					variant="outline"
																					size="sm"
																								onClick={() => aperturaPeriodoId === periodo.periodoId
																								? closeAperturaContext()
																						: loadAperturaContext(periodo.periodoId)}
																				>
																					Apertura revisada
																				</Button>
																			</div>
																		</TableCell>
																</TableRow>
																{aperturaPeriodoId === periodo.periodoId && (
																	<TableRow>
																		<TableCell colSpan={7}>
																			<div className="space-y-4 rounded-md bg-muted/30 p-4">
																				<h3 className="font-semibold">Apertura manual en CUP</h3>
																				<p className="text-sm text-muted-foreground">
																					Los importes y referencias son declaraciones manuales; no acreditan por sí mismos una fuente confiable. La aprobación vuelve a validar permisos, cuentas y evidencia en el servidor.
																				</p>
																						{!aperturaContext || aperturaContextPeriodId !== aperturaPeriodoId ? (
																					<p role="status">Cargando contexto de apertura…</p>
																				) : !aperturaContext.apertura ? (
																					<p role="status">Este período no tiene una apertura disponible para revisión.</p>
																				) : (
																					<>
																						{aperturaContext.revisiones?.[0] && (
																							<div className="rounded border p-3" aria-live="polite">
																								<p className="font-medium">
																									Revisión {aperturaContext.revisiones[0].version}: {aperturaContext.revisiones[0].estado}
																								</p>
																								{aperturaRevisionDetail?.lineas?.map((line: any) => (
																									<div key={line.lineaId} className="mt-2 text-sm">
																										{line.rolCuenta} · {line.cuentaId} · {line.lado} {line.importeNativo} CUP
																										<span className="block text-muted-foreground">
																											Referencia declarada: {line.fuenteId ?? "—"}; evidencia: {String(line.fuenteSnapshot?.note ?? "sin nota")}
																										</span>
																									</div>
																									))}
																							</div>
																						)}
																						{aperturaContext.revisiones?.[0]?.estado === "BORRADOR" && (
																							<Button size="sm" disabled={aperturaBusy} onClick={() => handleAperturaRevisionAction("submit")}>
																								Presentar revisión
																							</Button>
																						)}
																						{aperturaContext.revisiones?.[0]?.estado === "PRESENTADA" && (
																							<Button size="sm" disabled={aperturaBusy} onClick={() => handleAperturaRevisionAction("approve")}>
																								Aprobar apertura
																							</Button>
																						)}
																			{canCreateManualAperturaDraft(aperturaContext.revisiones?.[0]?.estado) && (
																							<div className="space-y-3 border-t pt-3">
																								<p className="text-sm font-medium">Nuevo borrador manual</p>
																								{aperturaLines.map((line, index) => (
																									<div key={index} className="grid gap-2 md:grid-cols-6">
																										<select aria-label={`Cuenta de línea ${index + 1}`} className="rounded border bg-background p-2 md:col-span-2" value={`${line.role}|${line.accountId}`} onChange={(event) => {
																											const option = aperturaContext.roles.find((role: any) => `${role.role}|${role.accountId}` === event.target.value);
																											if (option) setAperturaLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: option.role, accountId: option.accountId, label: option.label } : item));
																										}}>
																											{aperturaContext.roles.map((role: any) => <option key={`${role.role}-${role.accountId}`} value={`${role.role}|${role.accountId}`}>{role.role}: {role.label}</option>)}
																										</select>
																										<select aria-label={`Lado de línea ${index + 1}`} className="rounded border bg-background p-2" value={line.side} onChange={(event) => setAperturaLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, side: event.target.value as "DEBE" | "HABER" } : item))}>
																											<option value="DEBE">Debe</option><option value="HABER">Haber</option>
																										</select>
																										<input aria-label={`Importe CUP de línea ${index + 1}`} inputMode="decimal" required pattern="[0-9]+([.][0-9]{1,4})?" placeholder="Importe CUP" className="rounded border bg-background p-2" value={line.amount} onChange={(event) => setAperturaLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} />
																										<input aria-label={`Referencia manual de línea ${index + 1}`} required placeholder="Referencia" className="rounded border bg-background p-2" value={line.reference} onChange={(event) => setAperturaLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />
																		<input aria-label={`Nota manual de línea ${index + 1}`} required placeholder="Nota de evidencia declarada" className="rounded border bg-background p-2" value={line.note} onChange={(event) => setAperturaLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} />
																		<Button type="button" variant="ghost" size="sm" aria-label={`Eliminar línea ${index + 1}`} onClick={() => setAperturaLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Eliminar</Button>
																	</div>
																							))}
																							<div className="flex gap-2">
																								<Button type="button" variant="outline" size="sm" disabled={!aperturaContext.roles?.length} onClick={() => {
																									const role = aperturaContext.roles[0];
																									setAperturaLines((current) => [...current, { role: role.role, accountId: role.accountId, label: role.label, side: "DEBE", amount: "", reference: "", note: "" }]);
																								}}>Agregar línea</Button>
																								<Button size="sm" disabled={aperturaBusy || !aperturaLines.length || !aperturaContext.apertura.fechaCorte} onClick={handleCreateAperturaDraft}>Guardar borrador</Button>
																							</div>
																				</div>
																			)}
																			</>
																				)}
																			</div>
																		</TableCell>
																	</TableRow>
																)}
												{timelinePeriodoId === periodo.periodoId && (
													<TableRow key={`${periodo.periodoId}-timeline`}>
														<TableCell colSpan={7} className="p-0">
															<div className="px-4 pb-2 pt-2 grid grid-cols-3 gap-4 text-xs text-muted-foreground border-b">
																<div>
																	<span className="font-medium">Código:</span>{" "}
																	<span className="font-mono">
																		{periodo.codigo ?? "—"}
																	</span>
																</div>
																{periodo.abiertoPorId && (
																	<div>
																		<span className="font-medium">
																			Abierto por:
																		</span>{" "}
																		{periodo.abiertoPorId}
																		{periodo.fechaApertura && (
																			<span className="ml-1">
																				(
																				{new Date(
																					periodo.fechaApertura,
																				).toLocaleDateString()}
																				)
																			</span>
																		)}
																	</div>
																)}
																{periodo.cerradoPor && (
																	<div>
																		<span className="font-medium">
																			Cerrado por:
																		</span>{" "}
																		{periodo.cerradoPor}
																		{periodo.cerradoAt && (
																			<span className="ml-1">
																				(
																				{new Date(
																					periodo.cerradoAt,
																				).toLocaleDateString()}
																				)
																			</span>
																		)}
																	</div>
																)}
																{periodo.aprobadoPor && (
																	<div>
																		<span className="font-medium">
																			Aprobado por:
																		</span>{" "}
																		{periodo.aprobadoPor}
																		{periodo.aprobadoAt && (
																			<span className="ml-1">
																				(
																				{new Date(
																					periodo.aprobadoAt,
																				).toLocaleDateString()}
																				)
																			</span>
																		)}
																	</div>
																)}
																{periodo.segundoAprobadorId && (
																	<div>
																		<span className="font-medium">
																			2da Aprobación:
																		</span>{" "}
																		{periodo.segundoAprobadorId}
																	</div>
																)}
																{periodo.reabiertoPorId && (
																	<div>
																		<span className="font-medium">
																			Reabierto por:
																		</span>{" "}
																		{periodo.reabiertoPorId}
																	</div>
																)}
																{periodo.subperiodosCount > 0 && (
																	<div>
																		<span className="font-medium">
																			Subperíodos:
																		</span>{" "}
																		{periodo.subperiodosCount}
																	</div>
																)}
																{periodo.tieneHash && (
																	<div>
																		<span className="font-medium">Hash:</span>{" "}
																		<span className="font-mono">
																			{periodo.hashIntegridad?.slice(0, 16)}...
																		</span>
																	</div>
																)}
															</div>
															<div className="px-4 pb-4">
																<PeriodoTimeline
																	eventos={periodoTimeline}
																	isLoading={!timelineData[periodo.periodoId]}
																/>
															</div>
														</TableCell>
													</TableRow>
												)}
											</React.Fragment>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</>
			)}

			{/* Dialogs */}
			<AbrirPeriodoDialog
				open={showAbrirDialog}
				onOpenChange={setShowAbrirDialog}
				onSuccess={() => {
					toast.success("Período abierto correctamente");
					refreshPeriodos();
				}}
			/>

			<CerrarPeriodoDialog
				open={showCerrarDialog}
				onOpenChange={setShowCerrarDialog}
				onSuccess={() => {
					toast.success("Período cerrado correctamente");
					refreshPeriodos();
					setShowCerrarDialog(false);
				}}
				periodo={periodoSeleccionado}
			/>

			<ReabrirPeriodoDialog
				open={showReabrirDialog}
				onOpenChange={setShowReabrirDialog}
				onSuccess={() => {
					toast.success("Período reaperturado correctamente");
					refreshPeriodos();
					setShowReabrirDialog(false);
				}}
				periodo={periodoSeleccionado}
			/>

			{/* Approve confirmation dialog */}
			<Dialog open={showAprobarDialog} onOpenChange={setShowAprobarDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Aprobar Período Contable</DialogTitle>
						<DialogDescription>
							Esta acción marca el período como aprobado y es irreversible.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowAprobarDialog(false)}
						>
							Cancelar
						</Button>
						<Button
							onClick={() => {
								if (periodoSeleccionado) {
									handleAprobar(periodoSeleccionado);
									setShowAprobarDialog(false);
								}
							}}
						>
							Aprobar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
