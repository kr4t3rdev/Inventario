/**
 * @description Pantalla de cuadre de turno POS (estilo IPV clásico).
 * Muestra los productos del punto de venta con stock vs vendido, el resumen
 * del arqueo, y permite aprobar el cierre solo si el arqueo coincide con
 * el total de ventas.
 *
 * @param {object} props - Props del componente
 * @param {boolean} props.open - Estado del diálogo
 * @param {function} props.onOpenChange - Callback para cambio de estado
 * @param {string} props.turnoId - ID del turno a cuadrar
 * @param {string} props.puntoDeVentaId - ID del punto de venta
 * @param {function} props.onRepetirArqueo - Callback para volver al arqueo
 * @param {function} props.onSuccess - Callback al cerrar turno exitosamente
 * @returns {JSX.Element} Diálogo de cuadre de turno
 */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
	Loader2,
	CheckCircle2,
	AlertTriangle,
	XCircle,
	Store,
	User,
	DollarSign,
	ShoppingCart,
	Package,
	ArrowLeft,
	Lock,
	ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cerrarTurnoAction } from "@/features/turnos-pos/actions";
import { getCuadreTurnoAction } from "@/features/turnos-pos/actions-cuadre";
import type { CuadreTurnoData } from "@/features/turnos-pos/actions-cuadre";

interface CuadreTurnoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	turnoId: string;
	puntoDeVentaId: string;
	onRepetirArqueo?: () => void;
	onSuccess?: () => void;
}

export function CuadreTurnoDialog({
	open,
	onOpenChange,
	turnoId,
	puntoDeVentaId,
	onRepetirArqueo,
	onSuccess,
}: CuadreTurnoDialogProps) {
	const [data, setData] = useState<CuadreTurnoData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Cargar datos al abrir
	useEffect(() => {
		if (!open || !turnoId) return;

		const load = async () => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await getCuadreTurnoAction(turnoId);
				if (result.success && result.data) {
					setData(result.data);
				} else if (!result.success) {
					setError(result.error?.message ?? "Error al cargar cuadre");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Error al cargar cuadre");
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [open, turnoId]);

	const handleAprobar = async () => {
		if (!data) return;
		setIsSubmitting(true);
		try {
			const result = await cerrarTurnoAction({ turnoId });

			if (result.success) {
				toast.success("Turno cerrado exitosamente");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error(result.error?.message ?? "Error al cerrar turno");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Error al cerrar turno");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Calcular total del arqueo (centavos) y convertir a pesos para comparar
	// Restamos fondoInicialCup porque totalEfectivoCup incluye el fondo
	const arqueoTotalCup = data?.arqueo
		? (data.arqueo.totalEfectivoCup -
				data.turno.fondoInicialCup +
				data.arqueo.totalTarjeta +
				data.arqueo.totalTransferencia +
				data.arqueo.totalCredito) /
			100
		: 0;

	// totalVentaTurno ya está en pesos
	const totalVenta = data?.totalVentaTurno ?? 0;
	const diferencia = arqueoTotalCup - totalVenta;
	const tieneDiferencia = Math.abs(diferencia) > 0.01;

	// ─── Loading ──────────────────────────────────────

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>Cuadre del Turno</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-8 w-1/3" />
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── Error ─────────────────────────────────────────

	if (error || !data) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-600">
							<XCircle className="h-5 w-5" />
							Error al cargar cuadre
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						{error ?? "No se pudieron cargar los datos"}
					</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cerrar
						</Button>
						<Button onClick={() => onOpenChange(false)}>Volver</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ─── Loaded ────────────────────────────────────────

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"sm:max-w-4xl max-h-[90vh] transition-colors duration-500",
					tieneDiferencia
						? "border-red-300 dark:border-red-800"
						: "border-green-300 dark:border-green-800",
				)}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Store className="h-5 w-5 text-primary" />
						Cuadre del Turno — {data.turno.puntoDeVentaNombre}
					</DialogTitle>
					<DialogDescription>
						Verifique el inventario y las ventas antes de cerrar el turno
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[70vh] pr-4">
					<div className="space-y-4 py-2">
						{/* Header: datos del turno */}
						<div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/30 p-3 text-sm">
							{data.turno.empleado && (
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<User className="h-3.5 w-3.5" />
									<span className="font-medium text-foreground">
										{data.turno.empleado.nombre} {data.turno.empleado.apellido}
									</span>
								</div>
							)}
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<DollarSign className="h-3.5 w-3.5" />
								<span>
									Fondo: ${(data.turno.fondoInicialCup / 100).toFixed(2)} CUP
									{data.turno.fondoInicialUsd > 0 &&
										` · $${(data.turno.fondoInicialUsd / 100).toFixed(2)} USD`}
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<ShoppingCart className="h-3.5 w-3.5" />
								<span>
									Ventas: <strong>${totalVenta.toFixed(2)}</strong>
								</span>
							</div>
						</div>

						{/* Indicador de diferencia */}
						<div
							className={cn(
								"rounded-lg border p-3 flex items-start gap-3",
								tieneDiferencia
									? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
									: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
							)}
						>
							{tieneDiferencia ? (
								<>
									<AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
									<div className="text-sm text-red-800 dark:text-red-300">
										<p className="font-medium">Diferencia detectada</p>
										<p className="mt-1">
											El arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>)
											no coincide con el total de ventas (
											<strong>${totalVenta.toFixed(2)}</strong>). Diferencia:{" "}
											<strong
												className={
													diferencia < 0 ? "text-red-600" : "text-amber-600"
												}
											>
												{diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}
											</strong>
											. Revise el conteo e intente nuevamente.
										</p>
									</div>
								</>
							) : (
								<>
									<CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
									<div className="text-sm text-green-800 dark:text-green-300">
										<p className="font-medium">Cuadre correcto</p>
										<p className="mt-1">
											Arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>)
											coincide con el total de ventas (
											<strong>${totalVenta.toFixed(2)}</strong>). Puede cerrar
											el turno.
										</p>
									</div>
								</>
							)}
						</div>

						{/* Resumen del arqueo */}
						{data.arqueo && (
							<div className="rounded-lg border bg-card">
								<div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
									Resumen del Arqueo
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 text-sm">
									<div>
										<span className="text-muted-foreground">Efectivo CUP</span>
										<p className="font-medium tabular-nums">
											${(data.arqueo.totalEfectivoCup / 100).toFixed(2)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Efectivo USD</span>
										<p className="font-medium tabular-nums">
											${(data.arqueo.totalEfectivoUsd / 100).toFixed(2)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Tarjeta</span>
										<p className="font-medium tabular-nums">
											${(data.arqueo.totalTarjeta / 100).toFixed(2)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Transferencia</span>
										<p className="font-medium tabular-nums">
											${(data.arqueo.totalTransferencia / 100).toFixed(2)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Crédito</span>
										<p className="font-medium tabular-nums">
											${(data.arqueo.totalCredito / 100).toFixed(2)}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Tabla de productos */}
						<div className="rounded-lg border">
							<div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium flex items-center gap-2">
								<Package className="h-4 w-4" />
								Productos del Turno
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
											<th className="text-left px-3 py-2 font-medium">
												Producto
											</th>
											<th className="text-right px-3 py-2 font-medium">
												Stock
											</th>
											<th className="text-right px-3 py-2 font-medium">
												Vendido
											</th>
											<th className="text-right px-3 py-2 font-medium">
												Precio
											</th>
											<th className="text-right px-3 py-2 font-medium">
												Restante
											</th>
										</tr>
									</thead>
									<tbody>
										{data.productos.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="px-3 py-6 text-center text-muted-foreground"
												>
													No hay productos en este turno
												</td>
											</tr>
										) : (
											data.productos.map((p) => (
												<tr
													key={p.id}
													className={cn(
														"border-b last:border-b-0",
														tieneDiferencia && "text-red-700 dark:text-red-400",
													)}
												>
													<td className="px-3 py-2">
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
																<p className="font-medium truncate max-w-[200px]">
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
													<td className="px-3 py-2 text-right tabular-nums">
														{p.stockEnUbicacion} {p.unidad ?? ""}
													</td>
													<td className="px-3 py-2 text-right tabular-nums font-medium">
														{p.vendidoEnTurno}
													</td>
													<td className="px-3 py-2 text-right tabular-nums">
														${p.precioVenta.toFixed(2)}
													</td>
													<td className="px-3 py-2 text-right tabular-nums">
														{p.restante} {p.unidad ?? ""}
													</td>
												</tr>
											))
										)}
									</tbody>
									{/* Fila de totales */}
									{data.productos.length > 0 && (
										<tfoot>
											<tr className="border-t-2 bg-muted/30 font-semibold">
												<td className="px-3 py-2.5 text-sm">TOTAL</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{data.resumen.totalStock}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{data.resumen.totalVendido}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													${data.resumen.totalVentaMonto.toFixed(2)}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{data.resumen.totalStock}
												</td>
											</tr>
										</tfoot>
									)}
								</table>
							</div>
						</div>
					</div>
				</ScrollArea>

				<Separator className="my-2" />

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>

					{/* Repetir Arqueo — solo si hay diferencia */}
					{tieneDiferencia && onRepetirArqueo && (
						<Button
							variant="outline"
							onClick={() => {
								onRepetirArqueo?.();
							}}
							className="gap-1.5"
						>
							<ArrowLeft className="h-4 w-4" />
							Repetir Arqueo
						</Button>
					)}

					{/* Aprobar y cerrar — deshabilitado si hay diferencia */}
					<Button
						variant="default"
						onClick={handleAprobar}
						disabled={tieneDiferencia || isSubmitting}
						className={cn(
							"gap-1.5",
							tieneDiferencia
								? "opacity-50 cursor-not-allowed"
								: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600",
						)}
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Lock className="h-4 w-4" />
						)}
						{tieneDiferencia ? "Arqueo no coincide" : "Aprobar y Cerrar Turno"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
