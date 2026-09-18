'use client';

import { useMemo } from 'react';
import {
	ArrowLeft,
	CheckCircle2,
	DollarSign,
	Lock,
	Package,
	ShoppingCart,
	Store,
	User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { DemoProducto, DemoTurnoActivo } from '@/features/landing/components/pos-demo/mock-data';
import type { DemoArqueoResultado } from './demo-arqueo-form';

interface DemoVentaItem {
	productoId: string;
	cantidad: number;
	precioUnitario: number;
}

interface DemoCuadreTurnoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	turno: DemoTurnoActivo | null;
	/** Último arqueo registrado en el flujo (null si todavía no se hizo). */
	arqueo: DemoArqueoResultado | null;
	/** Productos disponibles en el PV demo (para la tabla de stock/vendido). */
	productos: DemoProducto[];
	/** Items vendidos durante el turno demo (acumulados por el POS demo). */
	ventasItems: DemoVentaItem[];
	/** Total acumulado de ventas del turno en pesos (no en centavos). */
	totalVentaTurno: number;
	onRepetirArqueo?: () => void;
	onSuccess?: () => void;
}

/**
 * @description Diálogo demo de cuadre de turno. Replica visual exacta del
 *              `CuadreTurnoDialog` real: header con datos del turno,
 *              indicador de diferencia, resumen del arqueo, tabla de
 *              productos (stock vs vendido vs restante) y botones de
 *              aprobar/repetir. Todo desde estado local, sin Server Actions.
 * @returns {JSX.Element} Diálogo de cuadre demo.
 */
export function DemoCuadreTurnoDialog({
	open,
	onOpenChange,
	turno,
	arqueo,
	productos,
	ventasItems,
	totalVentaTurno,
	onRepetirArqueo,
	onSuccess,
}: DemoCuadreTurnoDialogProps): React.JSX.Element | null {
	const data = useMemo(() => {
		if (!turno) return null;

		// Construir filas de productos con vendidoEnTurno/restante
		const ventasPorProducto = new Map<string, number>();
		for (const v of ventasItems) {
			ventasPorProducto.set(
				v.productoId,
				(ventasPorProducto.get(v.productoId) ?? 0) + v.cantidad,
			);
		}

		const filas = productos.map((p) => {
			const vendido = ventasPorProducto.get(p.id) ?? 0;
			return {
				id: p.id,
				nombre: p.nombre,
				codigoInterno: p.codigoBarras ?? null,
				stockEnUbicacion: p.stockEnUbicacion,
				vendidoEnTurno: vendido,
				precioVenta: p.precioVenta,
				restante: Math.max(0, p.stockEnUbicacion - vendido),
				foto: null,
				unidad: p.unidad?.simbolo ?? null,
			};
		});

		const totalStock = filas.reduce((s, p) => s + p.stockEnUbicacion, 0);
		const totalVendido = filas.reduce((s, p) => s + p.vendidoEnTurno, 0);

		return {
			turno: {
				id: turno.id,
				puntoDeVentaId: turno.puntoDeVentaId,
				puntoDeVentaNombre: turno.puntoDeVentaNombre,
				fondoInicialCup: turno.fondoInicialCup,
				fondoInicialUsd: turno.fondoInicialUsd,
				fechaApertura: turno.fechaApertura,
				fechaCierre: null,
				estado: turno.estado,
				tipo: 'demo',
				empleado: turno.empleado,
			},
			arqueo: arqueo
				? {
						id: arqueo.turnoId,
						totalEfectivoCup: arqueo.totalEfectivoCup,
						totalEfectivoUsd: arqueo.totalEfectivoUsd,
						totalTarjeta: arqueo.totalTarjeta,
						totalTransferencia: arqueo.totalTransferencia,
						totalCredito: arqueo.totalCredito,
						diferenciaCup: 0,
						diferenciaUsd: 0,
					}
				: null,
			totalVentaTurno,
			productos: filas,
			resumen: {
				totalStock,
				totalVendido,
				totalVentaMonto: totalVentaTurno,
			},
		};
	}, [turno, arqueo, productos, ventasItems, totalVentaTurno]);

	if (!turno || !data) return null;

	const arqueoTotalCup = data.arqueo
		? (data.arqueo.totalEfectivoCup -
				data.turno.fondoInicialCup +
				data.arqueo.totalTarjeta +
				data.arqueo.totalTransferencia +
				data.arqueo.totalCredito) /
			100
		: 0;

	const totalVenta = data.totalVentaTurno;
	const diferencia = arqueoTotalCup - totalVenta;
	const tieneDiferencia = Math.abs(diferencia) > 0.01;

	const handleAprobar = async () => {
		toast.success('Turno cerrado exitosamente');
		onOpenChange(false);
		onSuccess?.();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					'sm:max-w-4xl max-h-[90vh] transition-colors duration-500',
					tieneDiferencia
						? 'border-red-300 dark:border-red-800'
						: 'border-green-300 dark:border-green-800',
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

						<div
							className={cn(
								'rounded-lg border p-3 flex items-start gap-3',
								tieneDiferencia
									? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
									: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
							)}
						>
							{tieneDiferencia ? (
								<>
									<CheckCircle2 className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
									<div className="text-sm text-red-800 dark:text-red-300">
										<p className="font-medium">Diferencia detectada</p>
										<p className="mt-1">
											El arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>) no
											coincide con el total de ventas (
											<strong>${totalVenta.toFixed(2)}</strong>). Diferencia:{' '}
											<strong
												className={
													diferencia < 0 ? 'text-red-600' : 'text-amber-600'
												}
											>
												{diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}
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
											Arqueo (<strong>${arqueoTotalCup.toFixed(2)}</strong>){' '}
											{arqueo ? 'coincide' : 'está vacío —'} con el total de ventas (
											<strong>${totalVenta.toFixed(2)}</strong>). Puede cerrar el
											turno.
										</p>
									</div>
								</>
							)}
						</div>

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

						<div className="rounded-lg border">
							<div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium flex items-center gap-2">
								<Package className="h-4 w-4" />
								Productos del Turno
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
											<th className="text-left px-3 py-2 font-medium">Producto</th>
											<th className="text-right px-3 py-2 font-medium">Stock</th>
											<th className="text-right px-3 py-2 font-medium">Vendido</th>
											<th className="text-right px-3 py-2 font-medium">Precio</th>
											<th className="text-right px-3 py-2 font-medium">Restante</th>
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
														'border-b last:border-b-0',
														tieneDiferencia && 'text-red-700 dark:text-red-400',
													)}
												>
													<td className="px-3 py-2">
														<div className="flex items-center gap-2">
															<div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
																<Package className="h-4 w-4 text-muted-foreground" />
															</div>
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
														{p.stockEnUbicacion} {p.unidad ?? ''}
													</td>
													<td className="px-3 py-2 text-right tabular-nums font-medium">
														{p.vendidoEnTurno}
													</td>
													<td className="px-3 py-2 text-right tabular-nums">
														${p.precioVenta.toFixed(2)}
													</td>
													<td className="px-3 py-2 text-right tabular-nums">
														{p.restante} {p.unidad ?? ''}
													</td>
												</tr>
											))
										)}
									</tbody>
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

					<Button
						variant="default"
						onClick={handleAprobar}
						disabled={tieneDiferencia}
						className={cn(
							'gap-1.5',
							tieneDiferencia
								? 'opacity-50 cursor-not-allowed'
								: 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
						)}
					>
						<Lock className="h-4 w-4" />
						{tieneDiferencia ? 'Arqueo no coincide' : 'Aprobar y Cerrar Turno'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
