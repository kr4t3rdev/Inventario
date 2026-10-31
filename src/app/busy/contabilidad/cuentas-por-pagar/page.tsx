"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { EstadoBadge } from "@/features/contabilidad/components/cxp/estado-badge";
import { PagosExpandidos } from "@/features/contabilidad/components/cxp/pagos-expandidos";
import { CxpMetricsCards } from "@/features/contabilidad/components/cxp/cxp-metrics-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	CreditCard,
	FileText,
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Search,
	RefreshCw,
	ArrowLeft,
	Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CuentaPorPagar, PagoCuentaPorPagar } from "@/app/models/model";
import { getCuentasPorPagarAction } from "@/features/contabilidad";
import type { GetCuentasPorPagarResult } from "@/features/contabilidad";
import { ReconciliacionGastosForm } from "@/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";
import {
	m as motion,
	AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/utils";
import {
	PageTransition,
	StaggerContainer,
	StaggerItem,
	AnimatedCard,
} from "@/components/ui/animations";

const surfaceCardClass = cn(
	"relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
	"dark:border-slate-800/60 dark:bg-slate-950/15",
);

export default function CuentasPorPagarPage() {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [estado, setEstado] = useState<string>("all");
	const [tipo, setTipo] = useState<string>("all");
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(10);
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
	const [selectedCuenta, setSelectedCuenta] = useState<CuentaPorPagar | null>(
		null,
	);
	const [openPago, setOpenPago] = useState(false);

	// ── Data Fetching via Server Action ────────────────────
	const [dataResult, setDataResult] = useState<GetCuentasPorPagarResult | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [fetchError, setFetchError] = useState<unknown>(null);

	const loadData = useCallback(
		async (overrides: {
			search?: string;
			estado?: string;
			tipo?: string;
			page?: number;
			limit?: number;
		}) => {
			const s = overrides.search ?? "";
			const e = overrides.estado ?? "all";
			const t = overrides.tipo ?? "all";
			const p = overrides.page ?? 1;
			const l = overrides.limit ?? 10;

			setIsLoading(true);
			setFetchError(null);
			try {
				const result = await getCuentasPorPagarAction({
					search: s || undefined,
					estado:
						e !== "all" ? (e as "PENDIENTE" | "PAGADA" | "PARCIAL") : undefined,
					tipo: t !== "all" ? (t as "compra" | "servicio") : undefined,
					page: p,
					limit: l,
				});
				if (!result.success) {
					setFetchError(result.error.message ?? true);
				} else {
					setDataResult(result.data);
				}
			} catch (err) {
				setFetchError(err);
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	// Debounce de búsqueda: una sola consulta por pausa de tipado.
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1);
		}, 400);
		return () => clearTimeout(t);
	}, [search]);

	// Carga inicial + recarga en cualquier cambio de filtro o página.
	useEffect(() => {
		loadData({ search: debouncedSearch, estado, tipo, page, limit });
	}, [debouncedSearch, estado, tipo, page, limit, loadData]);

	const cuentas = useMemo(
		() => (dataResult?.cuentas ?? []) as unknown as CuentaPorPagar[],
		[dataResult],
	);
	const pagination = dataResult?.pagination;
	const showError = Boolean(fetchError) && !isLoading && !dataResult;
	const showEmpty = !isLoading && !showError && cuentas.length === 0;

	// Métricas calculadas
	// Métricas calculadas en el servidor sobre TODOS los registros (no solo la página)
	const metricas = useMemo(() => {
		const m = dataResult?.metricas;
		if (!m) {
			return {
				totalCuentas: 0,
				totalFacturado: 0,
				totalPagado: 0,
				totalSaldo: 0,
				cuentasPendientes: 0,
				cuentasPagadas: 0,
				porcentajePagado: 0,
			};
		}
		return {
			...m,
			porcentajePagado:
				m.totalFacturado > 0 ? (m.totalPagado / m.totalFacturado) * 100 : 0,
		};
	}, [dataResult?.metricas]);

	const toggleExpanded = (cuentaId: string) => {
		const newExpanded = new Set(expandedRows);
		if (newExpanded.has(cuentaId)) {
			newExpanded.delete(cuentaId);
		} else {
			newExpanded.add(cuentaId);
		}
		setExpandedRows(newExpanded);
	};

	const handleOpenPago = (cuenta: CuentaPorPagar) => {
		if (!cuenta.cuentaPorPagarId) {
			toast.error(
				"Esta factura no tiene cuenta por pagar asociada. Actualice los datos antes de registrar pagos.",
			);
			return;
		}
		if (cuenta.tipo === "compra" && !cuenta.gastoCompraId) {
			toast.error(
				"Esta compra no tiene un gasto asociado. Es posible que fue creada antes de la actualización del sistema. Por favor, contacte al administrador.",
			);
			return;
		}
		if (cuenta.tipo === "servicio" && !cuenta.gastosDEId) {
			toast.error(
				"Este servicio no tiene un gasto asociado. Es posible que fue creado antes de la actualización del sistema. Por favor, contacte al administrador.",
			);
			return;
		}
		setSelectedCuenta(cuenta);
		setOpenPago(true);
	};

	// Convertir CuentaPorPagar a GastoPendiente para el form de reconciliación
	const cuentaToGastoPendiente = (cuenta: CuentaPorPagar): any => ({
		tipo: cuenta.tipo === "compra" ? "compra" : "gastoDE",
		referenciaId:
			cuenta.gastoCompraId || cuenta.gastosDEId || cuenta.cuentaPorPagarId,
		descripcion: `Factura ${cuenta.numeroFactura} - ${cuenta.proveedorNombre}`,
		monto: cuenta.saldoPendiente,
		periodo: null,
		detalles: {
			vendor: cuenta.proveedorNombre,
			numeroFactura: cuenta.numeroFactura,
		},
		createdAt: cuenta.createdAt,
		updatedAt: cuenta.updatedAt,
	});

	const totalPages = pagination?.totalPages ?? 1;
	const totalRegistros = pagination?.total ?? 0;

	const agingStyles: Record<string, { label: string; className: string }> = {
		"0-30": {
			label: "0-30 días",
			className: "bg-emerald-100 text-emerald-700 border-emerald-200",
		},
		"31-60": {
			label: "31-60 días",
			className: "bg-amber-100 text-amber-700 border-amber-200",
		},
		"61-90": {
			label: "61-90 días",
			className: "bg-orange-100 text-orange-700 border-orange-200",
		},
		"90+": {
			label: "90+ días",
			className: "bg-red-100 text-red-700 border-red-200",
		},
	};

	return (
				<PageTransition className="container mx-auto py-6 px-4 space-y-8">
					<StaggerContainer className="space-y-8">
						{/* Header con navegación */}
						<StaggerItem>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
								<div>
									<div className="flex items-center gap-2 mb-2">
										<Button
											variant="ghost"
											size="sm"
											asChild
											className="h-8 px-2"
										>
											<Link href="/busy/contabilidad">
												<ArrowLeft className="h-4 w-4 mr-1" />
												Volver
											</Link>
										</Button>
									</div>
									<h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
										Cuentas por Pagar
									</h1>
									<p className="text-muted-foreground mt-1">
										Gestión y seguimiento de facturas de proveedores
									</p>
								</div>
								<div className="flex items-center gap-4">
									<Badge
										variant="outline"
										className="h-9 px-4 text-sm font-medium"
									>
										{metricas.totalCuentas} facturas registradas
									</Badge>
									<div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
										<Wallet className="h-6 w-6 text-slate-500 dark:text-slate-400" />
									</div>
								</div>
							</div>

							{/* Cards de métricas */}
				<CxpMetricsCards metricas={metricas} />
						</StaggerItem>

						{/* Filtros y tabla */}
						<StaggerItem>
							<Card className={surfaceCardClass}>
								<CardHeader className="gap-4">
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle>Facturas por Pagar</CardTitle>
											<p className="text-sm text-muted-foreground">
												Controla facturas entrantes de compras y servicios
											</p>
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => loadData({ search: debouncedSearch, estado, tipo, page, limit })}
											>
												<RefreshCw className="mr-2 h-4 w-4" />
												Actualizar
											</Button>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-4">
										<div className="flex items-center gap-2">
											<Search className="h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Buscar por factura o proveedor..."
												value={search}
												onChange={(event) => {
													setSearch(event.target.value);
													setPage(1);
												}}
											/>
										</div>
										<Select
											value={tipo}
											onValueChange={(value) => {
												setTipo(value);
												setPage(1);
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Tipo" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Todos los tipos</SelectItem>
												<SelectItem value="compra">Compras</SelectItem>
												<SelectItem value="servicio">Servicios</SelectItem>
											</SelectContent>
										</Select>
										<Select
											value={estado}
											onValueChange={(value) => {
												setEstado(value);
												setPage(1);
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Estado" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Todos los estados</SelectItem>
												<SelectItem value="PENDIENTE">Pendiente</SelectItem>
												<SelectItem value="PARCIAL">Parcial</SelectItem>
												<SelectItem value="PAGADA">Pagada</SelectItem>
											</SelectContent>
										</Select>
										<Select
											value={String(limit)}
											onValueChange={(value) => {
												setLimit(Number(value));
												setPage(1);
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Filas" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="10">10 filas</SelectItem>
												<SelectItem value="20">20 filas</SelectItem>
												<SelectItem value="50">50 filas</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</CardHeader>

								<CardContent className="p-0">
									<TooltipProvider>
										<div className="overflow-x-auto">
											<Table>
												<TableHeader className="bg-muted/50">
													<TableRow>
														<TableHead className="w-10"></TableHead>
														<TableHead className="font-semibold">
															Factura
														</TableHead>
														<TableHead className="font-semibold">
															Proveedor
														</TableHead>
														<TableHead className="font-semibold">
															Tipo
														</TableHead>
														<TableHead className="font-semibold">
															Antigüedad
														</TableHead>
														<TableHead className="font-semibold text-right">
															Deuda
														</TableHead>
														<TableHead className="font-semibold text-right">
															Pagado
														</TableHead>
														<TableHead className="font-semibold text-right">
															Saldo
														</TableHead>
														<TableHead className="font-semibold">
															Estado
														</TableHead>
														<TableHead className="font-semibold text-right">
															Acciones
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{isLoading &&
														Array.from({ length: 6 }).map((_, index) => (
															<TableRow key={`skeleton-${index}`}>
																{Array.from({ length: 10 }).map(
																	(__, cellIndex) => (
																		<TableCell
																			key={`skeleton-cell-${cellIndex}`}
																		>
																			<Skeleton className="h-4 w-full" />
																		</TableCell>
																	),
																)}
															</TableRow>
														))}

													{showError && (
														<TableRow>
															<TableCell
																colSpan={10}
																className="text-center py-12"
															>
																<div className="flex flex-col items-center justify-center text-destructive">
																	<AlertCircle className="h-12 w-12 mb-4" />
																	<h3 className="text-lg font-semibold mb-2">
																		Error al cargar las cuentas
																	</h3>
																	<p className="text-muted-foreground mb-4">
																		No se pudieron cargar las cuentas por pagar.
																	</p>
																	<Button
																		variant="outline"
onClick={() => loadData({ search: debouncedSearch, estado, tipo, page, limit })}
																	>
																		Intentar nuevamente
																	</Button>
																</div>
															</TableCell>
														</TableRow>
													)}

													{showEmpty && (
														<TableRow>
															<TableCell
																colSpan={10}
																className="text-center py-12"
															>
																<div className="flex flex-col items-center justify-center text-muted-foreground">
																	<FileText className="h-12 w-12 mb-4 opacity-50" />
																	<p className="text-lg font-medium">
																		No hay cuentas por pagar
																	</p>
																	<p className="text-sm">
																		Prueba ajustando los filtros de búsqueda
																	</p>
																</div>
															</TableCell>
														</TableRow>
													)}

													{!isLoading && (
														<AnimatePresence mode="popLayout">
															{cuentas.map((cuenta, index) => {
																const aging =
																	agingStyles[
																		cuenta.rangoAntiguedad ?? "0-30"
																	] || agingStyles["0-30"];
																const proveedor =
																	cuenta.proveedorNombre ||
																	cuenta.proveedor?.nombre ||
																	"Sin proveedor";
																const saldoPendiente = Number(
																	cuenta.saldoPendiente || 0,
																);
																const tienePagos =
																	cuenta.pagos && cuenta.pagos.length > 0;
																const isExpanded = expandedRows.has(
																	cuenta.cuentaPorPagarId,
																);

																return (
																	<React.Fragment key={cuenta.cuentaPorPagarId}>
																		<motion.tr
																			initial={{ opacity: 0, y: 20 }}
																			animate={{ opacity: 1, y: 0 }}
																			exit={{ opacity: 0, scale: 0.95 }}
																			transition={{
																				delay: index * 0.05,
																				duration: 0.2,
																			}}
																			className="transition-colors hover:bg-muted/30 border-b last:border-0"
																		>
																			<TableCell className="py-3">
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<Button
																							variant="ghost"
																							size="sm"
																							className="h-8 w-8 p-0"
																							onClick={() =>
																								toggleExpanded(
																									cuenta.cuentaPorPagarId,
																								)
																							}
																							disabled={!tienePagos}
																							aria-label={
																								isExpanded
																									? "Contraer detalles"
																									: "Expandir detalles"
																							}
																						>
																							{isExpanded ? (
																								<ChevronDown className="h-4 w-4" />
																							) : (
																								<ChevronRight
																									className={`h-4 w-4 ${tienePagos ? "text-primary" : "text-muted-foreground"}`}
																								/>
																							)}
																						</Button>
																					</TooltipTrigger>
																					<TooltipContent>
																						<p>
																							{tienePagos
																								? isExpanded
																									? "Ver menos"
																									: "Ver pagos"
																								: "Sin pagos registrados"}
																						</p>
																					</TooltipContent>
																				</Tooltip>
																			</TableCell>
																			<TableCell className="py-3">
																				<div className="font-medium">
																					{cuenta.numeroFactura}
																				</div>
																			</TableCell>
																			<TableCell className="py-3">
																				<div className="flex items-center gap-2">
																					<div className="h-8 w-8 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-sm">
																						{proveedor.charAt(0).toUpperCase()}
																					</div>
																					<span className="font-medium">
																						{proveedor}
																					</span>
																				</div>
																			</TableCell>
																			<TableCell className="py-3">
																				<Badge
																					variant="outline"
																					className="capitalize"
																				>
																					{cuenta.tipo === "compra"
																						? "Compra"
																						: "Servicio"}
																				</Badge>
																			</TableCell>
																			<TableCell className="py-3">
																				<div className="flex flex-col gap-1">
																					<Badge className={aging.className}>
																						{aging.label}
																					</Badge>
																					<span className="text-xs text-muted-foreground">
																						{cuenta.diasTranscurridos ?? 0} días
																					</span>
																				</div>
																			</TableCell>
																			<TableCell className="py-3 text-right font-semibold tabular-nums">
																				{formatCurrency(
																					Number(cuenta.montoDeuda || 0),
																				)}
																			</TableCell>
																			<TableCell className="py-3 text-right text-green-600 font-medium tabular-nums">
																				{formatCurrency(
																					Number(cuenta.montoPagado || 0),
																				)}
																			</TableCell>
																			<TableCell
																				className={`py-3 text-right font-bold tabular-nums ${saldoPendiente > 0 ? "text-red-600" : "text-green-600"}`}
																			>
																				{formatCurrency(saldoPendiente)}
																			</TableCell>
																			<TableCell className="py-3">
																				<EstadoBadge estado={cuenta.estado} />
																			</TableCell>
																			<TableCell className="py-3 text-right">
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<Button
																							size="sm"
																							disabled={saldoPendiente <= 0}
																							onClick={() =>
																								handleOpenPago(cuenta)
																							}
																							className={
																								saldoPendiente > 0
																									? "bg-primary hover:bg-primary/90 shadow-sm"
																									: ""
																							}
																						>
																							{saldoPendiente > 0
																								? "Pagar"
																								: "Pagado"}
																						</Button>
																					</TooltipTrigger>
																					<TooltipContent>
																						<p>
																							{saldoPendiente > 0
																								? "Registrar pago"
																								: "Factura ya pagada"}
																						</p>
																					</TooltipContent>
																				</Tooltip>
																			</TableCell>
																		</motion.tr>
																		<AnimatePresence>
																			{isExpanded && tienePagos && (
																				<motion.tr
																					initial={{ opacity: 0 }}
																					animate={{ opacity: 1 }}
																					exit={{ opacity: 0 }}
																					className="bg-muted/10"
																				>
																					<TableCell
																						colSpan={10}
																						className="p-0 border-b"
																					>
																						<PagosExpandidos
																							pagos={cuenta.pagos || []}
																						/>
																					</TableCell>
																				</motion.tr>
																			)}
																		</AnimatePresence>
																	</React.Fragment>
																);
															})}
														</AnimatePresence>
													)}
												</TableBody>
											</Table>
										</div>
									</TooltipProvider>

									{/* Paginación */}
									<div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
										<div className="text-sm text-muted-foreground">
											Mostrando{" "}
											<span className="font-medium text-foreground">
												{cuentas.length}
											</span>{" "}
											de{" "}
											<span className="font-medium text-foreground">
												{totalRegistros}
											</span>{" "}
											registros
										</div>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setPage((prev) => Math.max(1, prev - 1))}
												disabled={page <= 1}
												className="h-8"
											>
												Anterior
											</Button>
											<div className="text-sm text-muted-foreground px-2">
												Página {page} de {totalPages}
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													setPage((prev) => Math.min(totalPages, prev + 1))
												}
												disabled={page >= totalPages}
												className="h-8"
											>
												Siguiente
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						</StaggerItem>
					</StaggerContainer>

					{/* Dialog de pago */}
					{selectedCuenta && (
						<ReconciliacionGastosForm
							gasto={cuentaToGastoPendiente(selectedCuenta)}
							open={openPago}
							onClose={() => {
								setOpenPago(false);
								setSelectedCuenta(null);
							}}
							onSuccess={() => {
								setOpenPago(false);
								setSelectedCuenta(null);
								loadData({ search: debouncedSearch, estado, tipo, page, limit });
							}}
							isCuentaPorPagar={true}
							cuentaPorPagarId={selectedCuenta.cuentaPorPagarId}
						/>
					)}
				</PageTransition>
	);
}
