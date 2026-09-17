'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { calcularVuelto } from '@/features/ventas/services/pos-vuelto-calcu';

/** Método de pago del cobro del POS. */
export type MetodoPagoPos = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO';

/** Datos normalizados del cobro que el diálogo devuelve al confirmarse. */
export interface CobroPos {
	metodoPago: MetodoPagoPos;
	montoEfectivo: number | null;
	montoTarjeta: number | null;
	montoTransferencia: number | null;
	montoCredito: number | null;
	montoRecibidoEfectivo: number | null;
}

interface PosCobroDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	total: number;
	isProcessing?: boolean;
	onConfirm: (cobro: CobroPos) => void;
}

function toNum(v: string): number {
	const n = Number(v);
	return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * @description Diálogo de cobro del POS (VC): método de pago, desglose por
 * método, monto recibido en efectivo y vuelto en vivo; bloquea el cobro cuando
 * el recibido no alcanza la porción en efectivo o el MIXTO no suma el total.
 * @param {PosCobroDialogProps} props - Apertura, total y callback de confirmación.
 * @returns {JSX.Element} Diálogo de cobro.
 */
export function PosCobroDialog({ open, onOpenChange, total, isProcessing, onConfirm }: PosCobroDialogProps) {
	const [metodoPago, setMetodoPago] = useState<MetodoPagoPos>('EFECTIVO');
	const [montoEfectivoTxt, setMontoEfectivoTxt] = useState('');
	const [montoTarjetaTxt, setMontoTarjetaTxt] = useState('');
	const [montoTransferenciaTxt, setMontoTransferenciaTxt] = useState('');
	const [recibidoTxt, setRecibidoTxt] = useState('');

	const requiereEfectivo = metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO';
	const montoEfectivo = metodoPago === 'EFECTIVO' ? total : metodoPago === 'MIXTO' ? toNum(montoEfectivoTxt) : 0;
	const recibido = recibidoTxt === '' ? null : toNum(recibidoTxt);

	const vuelto = useMemo(
		() => calcularVuelto(metodoPago, montoEfectivo, recibido),
		[metodoPago, montoEfectivo, recibido],
	);

	const desgloseMixtoIncompleto =
		metodoPago === 'MIXTO' &&
		toNum(montoEfectivoTxt) + toNum(montoTarjetaTxt) + toNum(montoTransferenciaTxt) !== total;

	const recibidoInsuficiente = requiereEfectivo && recibido == null;
	const recibidoCorto = requiereEfectivo && recibido != null && recibido < montoEfectivo;

	const puedeCobrar = !isProcessing && !desgloseMixtoIncompleto && !recibidoInsuficiente && !recibidoCorto;

	const cobrar = () => {
		if (!puedeCobrar) return;
		onConfirm({
			metodoPago,
			montoEfectivo: metodoPago === 'EFECTIVO' ? total : metodoPago === 'MIXTO' ? toNum(montoEfectivoTxt) : null,
			montoTarjeta: metodoPago === 'TARJETA' ? total : metodoPago === 'MIXTO' ? toNum(montoTarjetaTxt) : null,
			montoTransferencia: metodoPago === 'TRANSFERENCIA' ? total : metodoPago === 'MIXTO' ? toNum(montoTransferenciaTxt) : null,
			montoCredito: metodoPago === 'CREDITO' ? total : null,
			montoRecibidoEfectivo: requiereEfectivo ? recibido : null,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Cobrar venta</DialogTitle>
					<DialogDescription>
						Total a cobrar: {formatCurrency(total)}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					<div className="grid gap-1">
						<Label htmlFor="metodo-pago">Método de pago</Label>
						<select
							id="metodo-pago"
							className="h-9 rounded-md border bg-background px-3 text-sm"
							value={metodoPago}
							onChange={(e) => setMetodoPago(e.target.value as MetodoPagoPos)}
						>
							<option value="EFECTIVO">Efectivo</option>
							<option value="TARJETA">Tarjeta</option>
							<option value="TRANSFERENCIA">Transferencia</option>
							<option value="CREDITO">Crédito</option>
							<option value="MIXTO">Mixto</option>
						</select>
					</div>

					{metodoPago === 'MIXTO' && (
						<div className="grid gap-2 rounded-md border p-3">
							<p className="text-xs font-medium text-muted-foreground">
								Desglose mixto (debe sumar {formatCurrency(total)})
							</p>
							<div className="grid gap-1">
								<Label htmlFor="monto-efectivo">Monto efectivo</Label>
								<Input id="monto-efectivo" inputMode="numeric" value={montoEfectivoTxt} onChange={(e) => setMontoEfectivoTxt(e.target.value)} />
							</div>
							<div className="grid gap-1">
								<Label htmlFor="monto-tarjeta">Monto tarjeta</Label>
								<Input id="monto-tarjeta" inputMode="numeric" value={montoTarjetaTxt} onChange={(e) => setMontoTarjetaTxt(e.target.value)} />
							</div>
							<div className="grid gap-1">
								<Label htmlFor="monto-transferencia">Monto transferencia</Label>
								<Input id="monto-transferencia" inputMode="numeric" value={montoTransferenciaTxt} onChange={(e) => setMontoTransferenciaTxt(e.target.value)} />
							</div>
							{desgloseMixtoIncompleto && (
								<p className="text-xs text-destructive">
									La suma de los montos debe ser igual al total de la venta.
								</p>
							)}
						</div>
					)}

					{requiereEfectivo && (
						<div className="grid gap-1">
							<Label htmlFor="monto-recibido">Monto recibido (efectivo)</Label>
							<Input
								id="monto-recibido"
								inputMode="numeric"
								value={recibidoTxt}
								onChange={(e) => setRecibidoTxt(e.target.value)}
								placeholder={`Mínimo ${formatCurrency(montoEfectivo)}`}
							/>
						</div>
					)}

					{recibidoCorto && (
						<p className="text-xs font-medium text-destructive">
							El monto recibido es insuficiente para cubrir el efectivo.
						</p>
					)}

					{vuelto != null && recibido != null && recibido >= montoEfectivo && (
						<p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
							Vuelto a entregar: {formatCurrency(vuelto)}
						</p>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
						Cancelar
					</Button>
					<Button onClick={cobrar} disabled={!puedeCobrar}>
						{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Cobrar
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
