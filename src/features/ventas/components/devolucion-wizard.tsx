'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
	getDevolucionContextoAction,
	registrarDevolucionAction,
} from '@/features/ventas/actions-devoluciones';

interface ItemContexto {
	ventaItemId: string;
	nombre: string;
	cantidadVendida: number;
	yaDevuelto: number;
	disponible: number;
	precioUnitario: number;
}

interface DevolucionWizardProps {
	ventaId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * @description Wizard de devolución de una venta (DNC): selección de ítems con
 * máximo por lo vendido y no devuelto, motivo obligatorio y preferencia
 * financiera del excedente (saldo a favor o reembolso en efectivo).
 * @param {DevolucionWizardProps} props - Venta y control del diálogo.
 * @returns {JSX.Element} Diálogo de devolución.
 */
export function DevolucionWizard({ ventaId, open, onOpenChange }: DevolucionWizardProps) {
	const router = useRouter();
	const [items, setItems] = useState<ItemContexto[]>([]);
	const [saldoCxc, setSaldoCxc] = useState(0);
	const [hayTurnoAbierto, setHayTurnoAbierto] = useState(false);
	const [hayCliente, setHayCliente] = useState(true);
	const [descuentoVenta, setDescuentoVenta] = useState(0);
	const [brutoVenta, setBrutoVenta] = useState(0);
	const [motivo, setMotivo] = useState('');
	const [preferencia, setPreferencia] = useState<'SALDO_FAVOR' | 'REEMBOLSO_EFECTIVO'>('SALDO_FAVOR');
	const [seleccion, setSeleccion] = useState<Map<string, number>>(new Map());
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [idempotencyKey, setIdempotencyKey] = useState('');

	useEffect(() => {
		if (!open) return;
		setIsLoading(true);
		setIdempotencyKey(crypto.randomUUID());
		setSeleccion(new Map());
		setMotivo('');
		setPreferencia('SALDO_FAVOR');
		getDevolucionContextoAction(ventaId)
			.then((r) => {
				if (!r.success) {
					toast.error(r.error?.message || 'No se pudo cargar la venta');
					onOpenChange(false);
					return;
				}
				const data = r.data;
				if (data) {
					setItems(data.items);
					setSaldoCxc(data.saldoCxc);
					setHayTurnoAbierto(data.hayTurnoAbierto);
					setHayCliente(data.venta.cliente != null);
					setDescuentoVenta(data.venta.descuento ?? 0);
					setBrutoVenta(
						data.items.reduce((acc, i) => acc + i.precioUnitario * i.cantidadVendida, 0),
					);
					// Sin cliente, el default orienta al único canal posible del excedente.
					if (data.venta.cliente == null && data.hayTurnoAbierto) {
						setPreferencia('REEMBOLSO_EFECTIVO');
					}
				}
			})
			.catch(() => {
				toast.error('Error al cargar el contexto de devolución');
				onOpenChange(false);
			})
			.finally(() => setIsLoading(false));
	}, [open, ventaId, onOpenChange]);

	const subtotal = useMemo(
		() =>
			items.reduce((acc, item) => acc + (seleccion.get(item.ventaItemId) ?? 0) * item.precioUnitario, 0),
		[items, seleccion],
	);
	// Preview del descuento prorrateado (misma fórmula del motor: floor + cap).
	const descuentoEstimado = useMemo(() => {
		if (subtotal <= 0) return 0;
		const prorrateo = brutoVenta > 0 ? Math.floor((descuentoVenta * subtotal) / brutoVenta) : 0;
		return Math.min(prorrateo, subtotal);
	}, [subtotal, descuentoVenta, brutoVenta]);
	const totalEstimado = subtotal - descuentoEstimado;
	const aplicableCxc = Math.min(totalEstimado, saldoCxc);
	const excedente = totalEstimado - aplicableCxc;

	const setCantidad = (ventaItemId: string, cantidad: number, disponible: number) => {
		setSeleccion((prev) => {
			const next = new Map(prev);
			if (cantidad <= 0) next.delete(ventaItemId);
			else next.set(ventaItemId, Math.min(cantidad, disponible));
			return next;
		});
	};

	const ningunCanal = !hayCliente && !hayTurnoAbierto;
	const handleSubmit = async () => {
		const itemsOut = Array.from(seleccion.entries()).map(([ventaItemId, cantidad]) => ({
			ventaItemId,
			cantidad,
		}));
		if (itemsOut.length === 0) {
			toast.error('Seleccione al menos un ítem a devolver');
			return;
		}
		if (motivo.trim().length < 3) {
			toast.error('Describa el motivo de la devolución (mínimo 3 caracteres)');
			return;
		}
		if (ningunCanal && excedente > 0) {
			toast.error('Sin cliente ni turno abierto no hay destino para el excedente. Asigne un cliente o abra un turno.');
			return;
		}
		setIsSaving(true);
		try {
			const r = await registrarDevolucionAction({
				ventaId,
				items: itemsOut,
				motivo: motivo.trim(),
				preferenciaFinanciera: preferencia,
				idempotencyKey,
			});
			if (r.success) {
				toast.success('Devolución registrada');
				onOpenChange(false);
				router.refresh();
			} else {
				toast.error(r.error?.message || 'No se pudo registrar la devolución');
			}
		} catch {
			toast.error('Error de red al registrar la devolución');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Devolver mercancía</DialogTitle>
					<DialogDescription>
						Seleccione las cantidades a reintegrar al stock. La nota de crédito se emite si su plan
						incluye facturación.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" />
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-2">
							{items.map((item) => {
								const sel = seleccion.get(item.ventaItemId) ?? 0;
								return (
									<div key={item.ventaItemId} className="flex items-center gap-3 rounded-md border p-2">
										<div className="flex-1">
											<p className="text-sm font-medium">{item.nombre}</p>
											<p className="text-xs text-muted-foreground">
												Vendidas: {item.cantidadVendida}
												{item.yaDevuelto > 0 ? ` · ya devueltas: ${item.yaDevuelto}` : ''} ·
												disponibles: {item.disponible}
											</p>
										</div>
										<Input
											type="number"
											min={0}
											max={item.disponible}
											className="w-20"
											value={sel}
											disabled={item.disponible === 0}
											onChange={(e) =>
												setCantidad(
													item.ventaItemId,
													Math.max(0, Number(e.target.value) || 0),
													item.disponible,
												)
											}
											aria-label={`Cantidad a devolver de ${item.nombre}`}
										/>
									</div>
								);
							})}
						</div>

						<div className="grid gap-2">
							<Label htmlFor="motivo-devolucion">Motivo</Label>
							<Textarea
								id="motivo-devolucion"
								value={motivo}
								onChange={(e) => setMotivo(e.target.value)}
								maxLength={500}
								placeholder="Describa el motivo de la devolución"
							/>
						</div>

						{subtotal > 0 && (
							<div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
								<p className="font-medium">
									Total a devolver: {formatCurrency(totalEstimado)}
								</p>
								{descuentoEstimado > 0 && (
									<p className="text-xs text-muted-foreground">
										(incluye {formatCurrency(descuentoEstimado)} de descuento prorrateado)
									</p>
								)}
								{aplicableCxc > 0 && (
									<p>Se descuenta de la deuda del cliente: {formatCurrency(aplicableCxc)}</p>
								)}
								{excedente > 0 && (
									<p>Excedente a favor del cliente: {formatCurrency(excedente)}</p>
								)}
							</div>
						)}

						{excedente > 0 && (
							<div className="space-y-2">
								<Label>Destino del excedente</Label>
								<RadioGroup
									value={preferencia}
									onValueChange={(v) => setPreferencia(v as typeof preferencia)}
									className="grid gap-2"
								>
									<label className="flex items-center gap-2 text-sm">
										<RadioGroupItem value="SALDO_FAVOR" disabled={!hayCliente} />
										Saldo a favor del cliente (anticipo reutilizable)
										{!hayCliente && (
											<span className="text-xs text-muted-foreground">
												(requiere cliente asociado a la venta)
											</span>
										)}
									</label>
									<label className="flex items-center gap-2 text-sm">
										<RadioGroupItem value="REEMBOLSO_EFECTIVO" disabled={!hayTurnoAbierto} />
										Reembolso en efectivo de la caja actual
										{!hayTurnoAbierto && (
											<span className="text-xs text-muted-foreground">
												(requiere turno abierto)
											</span>
										)}
									</label>
								</RadioGroup>
							</div>
						)}
					</div>
				)}

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={isSaving || isLoading || totalEstimado <= 0}>
						{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Registrar devolución
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
