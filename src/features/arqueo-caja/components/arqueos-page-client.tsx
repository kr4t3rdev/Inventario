/**
 * @description Página cliente del historial de arqueos de caja.
 * Muestra tabla con todos los arqueos, filtros por fecha/PV, y detalle expandible
 * con el conteo de billetes.
 *
 * @returns {JSX.Element} Página de historial de arqueos
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
	Search,
	Filter,
	DollarSign,
	TrendingUp,
	TrendingDown,
	Minus,
	Eye,
	Download,
	CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getArqueosAction } from "@/features/arqueo-caja/actions";
import { getPuntosDeVentaAction } from "@/features/puntos-venta/actions";
import {
	DENOMINACIONES_CUP,
	DENOMINACIONES_USD,
} from "@/features/arqueo-caja/components/denominaciones";
import type { ArqueoCajaWithRelations } from "@/features/arqueo-caja/types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────

const formatCurrency = (cents: number) => {
	const sign = cents < 0 ? "-" : "";
	return `${sign}$${Math.abs(cents / 100).toLocaleString("es-CU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Traduce el valor facial de centavos a pesos para mostrar */
const centavosAPesos = (centavos: number) => (centavos / 100).toFixed(0);

interface PvOption {
	pvId: string;
	nombre: string;
}

// ─── Componente de detalle del arqueo ─────────────────────

function ArqueoDetalleDialog({
	arqueo,
	open,
	onOpenChange,
}: {
	arqueo: ArqueoCajaWithRelations | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	if (!arqueo) return null;

	const billetesCup = [
		{ label: "$1000", cantidad: arqueo.billetes1000Cup },
		{ label: "$500", cantidad: arqueo.billetes500Cup },
		{ label: "$200", cantidad: arqueo.billetes200Cup },
		{ label: "$100", cantidad: arqueo.billetes100Cup },
		{ label: "$50", cantidad: arqueo.billetes50Cup },
		{ label: "$20", cantidad: arqueo.billetes20Cup },
		{ label: "Monedas", cantidad: arqueo.monedasCup },
	];

	const billetesUsd = [
		{ label: "$100 USD", cantidad: arqueo.billetes100Usd },
		{ label: "$50 USD", cantidad: arqueo.billetes50Usd },
		{ label: "$20 USD", cantidad: arqueo.billetes20Usd },
		{ label: "$10 USD", cantidad: arqueo.billetes10Usd },
		{ label: "$5 USD", cantidad: arqueo.billetes5Usd },
		{ label: "$1 USD", cantidad: arqueo.billetes1Usd },
		{ label: "Monedas", cantidad: arqueo.monedasUsd },
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5 text-primary" />
						Detalle del Arqueo
					</DialogTitle>
					<DialogDescription>
						{arqueo.turno?.puntoDeVenta?.nombre ?? "POS"} &mdash;{" "}
						{format(
							new Date(arqueo.createdAt),
							"d 'de' MMM 'del' yyyy, HH:mm",
							{ locale: es },
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Totales */}
					<div className="grid grid-cols-2 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm text-muted-foreground">
									Efectivo CUP
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-2xl font-bold">
									{formatCurrency(arqueo.totalEfectivoCup)}
								</p>
								<p className="text-xs text-muted-foreground">
									Esperado: {formatCurrency(arqueo.esperadoEfectivoCup)}
								</p>
								<p
									className={cn(
										"text-sm font-medium",
										arqueo.diferenciaCup === 0
											? "text-muted-foreground"
											: arqueo.diferenciaCup > 0
												? "text-green-600"
												: "text-red-600",
									)}
								>
									{arqueo.diferenciaCup === 0 ? (
										<>
											<Minus className="inline h-3 w-3 mr-1" />
											Sin diferencia
										</>
									) : arqueo.diferenciaCup > 0 ? (
										<>
											<TrendingUp className="inline h-3 w-3 mr-1" />
											Sobrante: {formatCurrency(arqueo.diferenciaCup)}
										</>
									) : (
										<>
											<TrendingDown className="inline h-3 w-3 mr-1" />
											Faltante: {formatCurrency(arqueo.diferenciaCup)}
										</>
									)}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm text-muted-foreground">
									Efectivo USD
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-2xl font-bold">
									{formatCurrency(arqueo.totalEfectivoUsd)}
								</p>
								<p className="text-xs text-muted-foreground">
									Esperado: {formatCurrency(arqueo.esperadoEfectivoUsd)}
								</p>
								<p
									className={cn(
										"text-sm font-medium",
										arqueo.diferenciaUsd === 0
											? "text-muted-foreground"
											: arqueo.diferenciaUsd > 0
												? "text-green-600"
												: "text-red-600",
									)}
								>
									{arqueo.diferenciaUsd === 0 ? (
										<>
											<Minus className="inline h-3 w-3 mr-1" />
											Sin diferencia
										</>
									) : arqueo.diferenciaUsd > 0 ? (
										<>
											<TrendingUp className="inline h-3 w-3 mr-1" />
											Sobrante: {formatCurrency(arqueo.diferenciaUsd)}
										</>
									) : (
										<>
											<TrendingDown className="inline h-3 w-3 mr-1" />
											Faltante: {formatCurrency(arqueo.diferenciaUsd)}
										</>
									)}
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Conteo CUP */}
					<div>
						<h4 className="text-sm font-semibold mb-2">Conteo Billetes CUP</h4>
						<div className="grid grid-cols-4 gap-2">
							{billetesCup.map((b) => (
								<div
									key={b.label}
									className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
								>
									<span className="text-muted-foreground">{b.label}</span>
									<span className="font-medium">{b.cantidad}</span>
								</div>
							))}
						</div>
					</div>

					{/* Conteo USD */}
					<div>
						<h4 className="text-sm font-semibold mb-2">Conteo Billetes USD</h4>
						<div className="grid grid-cols-4 gap-2">
							{billetesUsd.map((b) => (
								<div
									key={b.label}
									className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
								>
									<span className="text-muted-foreground">{b.label}</span>
									<span className="font-medium">{b.cantidad}</span>
								</div>
							))}
						</div>
					</div>

					{/* Otros métodos de pago */}
					<div>
						<h4 className="text-sm font-semibold mb-2">
							Otros Métodos de Pago
						</h4>
						<div className="grid grid-cols-3 gap-2">
							<div className="rounded-md border px-3 py-2 text-sm">
								<span className="text-muted-foreground">Tarjeta</span>
								<p className="font-medium">
									{formatCurrency(arqueo.totalTarjeta)}
								</p>
							</div>
							<div className="rounded-md border px-3 py-2 text-sm">
								<span className="text-muted-foreground">Transferencia</span>
								<p className="font-medium">
									{formatCurrency(arqueo.totalTransferencia)}
								</p>
							</div>
							<div className="rounded-md border px-3 py-2 text-sm">
								<span className="text-muted-foreground">Crédito</span>
								<p className="font-medium">
									{formatCurrency(arqueo.totalCredito)}
								</p>
							</div>
						</div>
					</div>

					{/* Observaciones */}
					{arqueo.observaciones && (
						<div>
							<h4 className="text-sm font-semibold mb-1">Observaciones</h4>
							<p className="text-sm text-muted-foreground rounded-md border bg-muted/50 px-3 py-2">
								{arqueo.observaciones}
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Componente de loading ────────────────────────────────

function ArqueosPageLoader() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-8 w-60" />
				<Skeleton className="h-4 w-80" />
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-10 w-40" />
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-10 w-32" />
			</div>
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

// ─── Componente principal ─────────────────────────────────

export function ArqueosPageClient() {
	const [arqueos, setArqueos] = useState<ArqueoCajaWithRelations[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [puntosDeVenta, setPuntosDeVenta] = useState<PvOption[]>([]);

	// Filtros
	const [filtroPv, setFiltroPv] = useState("__all__");
	const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
	const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
	const [filtroSoloDif, setFiltroSoloDif] = useState(false);

	// Detalle
	const [detalleArqueo, setDetalleArqueo] =
		useState<ArqueoCajaWithRelations | null>(null);
	const [isDetalleOpen, setIsDetalleOpen] = useState(false);

	const loadArqueos = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await getArqueosAction({
				puntoDeVentaId: filtroPv !== "__all__" ? filtroPv : undefined,
				fechaDesde: filtroFechaDesde || undefined,
				fechaHasta: filtroFechaHasta || undefined,
				soloConDiferencia: filtroSoloDif || undefined,
				limit: 200,
			});
			if (result.success) {
				setArqueos(result.data ?? []);
			} else {
				toast.error(result.error?.message ?? "Error al cargar arqueos");
			}
		} catch {
			toast.error("Error al cargar arqueos");
		} finally {
			setIsLoading(false);
		}
	}, [filtroPv, filtroFechaDesde, filtroFechaHasta, filtroSoloDif]);

	const loadPuntosDeVenta = useCallback(async () => {
		try {
			const result = await getPuntosDeVentaAction();
			if (result.success) {
				setPuntosDeVenta(result.data ?? []);
			}
		} catch {
			// Silently fail
		}
	}, []);

	useEffect(() => {
		loadPuntosDeVenta();
	}, [loadPuntosDeVenta]);

	useEffect(() => {
		loadArqueos();
	}, [loadArqueos]);

	const abrirDetalle = (arqueo: ArqueoCajaWithRelations) => {
		setDetalleArqueo(arqueo);
		setIsDetalleOpen(true);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Historial de Arqueos
				</h1>
				<p className="text-sm text-muted-foreground">
					Registro de arqueos de caja realizados en todos los puntos de venta
				</p>
			</div>

			{/* Filtros */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-wrap gap-3 items-end">
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground font-medium">
								Punto de Venta
							</label>
							<Select value={filtroPv} onValueChange={setFiltroPv}>
								<SelectTrigger className="w-48">
									<SelectValue placeholder="Todos los PV" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">Todos los PV</SelectItem>
									{puntosDeVenta.map((pv) => (
										<SelectItem key={pv.pvId} value={pv.pvId}>
											{pv.nombre}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1">
							<label className="text-xs text-muted-foreground font-medium">
								Desde
							</label>
							<div className="relative">
								<CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="date"
									className="pl-8 w-44"
									value={filtroFechaDesde}
									onChange={(e) => setFiltroFechaDesde(e.target.value)}
								/>
							</div>
						</div>

						<div className="space-y-1">
							<label className="text-xs text-muted-foreground font-medium">
								Hasta
							</label>
							<div className="relative">
								<CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="date"
									className="pl-8 w-44"
									value={filtroFechaHasta}
									onChange={(e) => setFiltroFechaHasta(e.target.value)}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 pb-0.5">
							<Button
								variant={filtroSoloDif ? "default" : "outline"}
								size="sm"
								onClick={() => setFiltroSoloDif(!filtroSoloDif)}
							>
								<Filter className="h-4 w-4 mr-1" />
								Solo con diferencias
							</Button>
							<Button variant="secondary" size="sm" onClick={loadArqueos}>
								<Search className="h-4 w-4 mr-1" />
								Buscar
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Tabla */}
			{isLoading ? (
				<ArqueosPageLoader />
			) : arqueos.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
						<p className="text-muted-foreground">No hay arqueos registrados</p>
						<p className="text-xs text-muted-foreground/60 mt-1">
							Los arqueos aparecerán aquí cuando se realicen desde el POS
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Fecha</TableHead>
									<TableHead>Punto de Venta</TableHead>
									<TableHead>Cajero</TableHead>
									<TableHead className="text-right">Efectivo CUP</TableHead>
									<TableHead className="text-right">Efectivo USD</TableHead>
									<TableHead className="text-right">Tarjeta</TableHead>
									<TableHead className="text-right">Transf.</TableHead>
									<TableHead className="text-right">Dif. CUP</TableHead>
									<TableHead className="text-right">Dif. USD</TableHead>
									<TableHead className="text-right">Contab.</TableHead>
									<TableHead className="text-center">Detalle</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{arqueos.map((a) => (
									<TableRow
										key={a.id}
										className={cn(
											a.diferenciaCup !== 0 || a.diferenciaUsd !== 0
												? "bg-red-50/30 dark:bg-red-950/10"
												: "",
										)}
									>
										<TableCell className="whitespace-nowrap text-sm">
											{format(new Date(a.createdAt), "d MMM HH:mm", {
												locale: es,
											})}
										</TableCell>
										<TableCell className="font-medium">
											{a.turno?.puntoDeVenta?.nombre ?? "—"}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{a.turno?.empleado
												? `${a.turno.empleado.nombre} ${a.turno.empleado.apellido}`
												: "—"}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{formatCurrency(a.totalEfectivoCup)}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{a.totalEfectivoUsd > 0
												? formatCurrency(a.totalEfectivoUsd)
												: "—"}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{a.totalTarjeta > 0
												? formatCurrency(a.totalTarjeta)
												: "—"}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">
											{a.totalTransferencia > 0
												? formatCurrency(a.totalTransferencia)
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{a.diferenciaCup === 0 ? (
												<span className="text-muted-foreground">—</span>
											) : (
												<Badge
													variant={
														a.diferenciaCup > 0 ? "default" : "destructive"
													}
													className="font-mono"
												>
													{a.diferenciaCup > 0 ? "+" : ""}
													{formatCurrency(a.diferenciaCup)}
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											{a.diferenciaUsd === 0 ? (
												<span className="text-muted-foreground">—</span>
											) : (
												<Badge
													variant={
														a.diferenciaUsd > 0 ? "default" : "destructive"
													}
													className="font-mono"
												>
													{a.diferenciaUsd > 0 ? "+" : ""}
													{formatCurrency(a.diferenciaUsd)}
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-center">
											{a.contabilizado ? (
												<Badge
													variant="outline"
													className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200"
												>
													✅
												</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="text-center">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => abrirDetalle(a)}
											>
												<Eye className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</Card>
			)}

			{/* Dialog de detalle */}
			<ArqueoDetalleDialog
				arqueo={detalleArqueo}
				open={isDetalleOpen}
				onOpenChange={setIsDetalleOpen}
			/>
		</div>
	);
}
