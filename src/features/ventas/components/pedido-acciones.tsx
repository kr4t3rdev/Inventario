'use client';

import { useState } from 'react';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PackageCheck, FileText, Loader2 } from 'lucide-react';
import { entregarVentaAction, facturarVentaAction } from '@/features/ventas/actions';
import { formatCurrency } from '@/lib/utils';

interface PedidoAccionesProps {
	ventaId: string;
	estado: string;
	total: number;
}

/**
 * @description Acciones del ciclo de vida de un pedido de venta en la tabla:
 * "Entregar" para PEDIDO y "Facturar" (con diálogo de cobro) para ENTREGADA.
 * El permiso se exige en servidor (ventas.pedido.gestionar).
 * @param {PedidoAccionesProps} props - ID de venta, estado actual y total.
 * @returns {JSX.Element | null} Botones de transición o null si no aplican.
 */
export function PedidoAcciones({ ventaId, estado, total }: PedidoAccionesProps) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [facturarOpen, setFacturarOpen] = useState(false);
	const [metodoPago, setMetodoPago] = useState<string>('EFECTIVO');
	const [fechaVencimiento, setFechaVencimiento] = useState('');

	const handleEntregar = async () => {
		setIsPending(true);
		try {
			const r = await entregarVentaAction(ventaId);
			if (r.success) {
				toast.success('Pedido entregado: stock descontado correctamente');
				router.refresh();
			} else {
				toast.error(r.error?.message || 'No se pudo entregar el pedido');
			}
		} catch {
			toast.error('Error de red al entregar el pedido');
		} finally {
			setIsPending(false);
		}
	};

	const handleFacturar = async () => {
		setIsPending(true);
		try {
			const esCredito = metodoPago === 'CREDITO';
			const input = {
				metodoPago: metodoPago as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO',
				...(metodoPago === 'EFECTIVO' ? { montoEfectivo: total } : {}),
				...(metodoPago === 'TARJETA' ? { montoTarjeta: total } : {}),
				...(metodoPago === 'TRANSFERENCIA' ? { montoTransferencia: total } : {}),
				...(esCredito ? { montoCredito: total } : {}),
				...(esCredito
					? { tipoVencimiento: 'fecha' as const, fechaVencimiento: fechaVencimiento || undefined }
					: {}),
			};
			const r = await facturarVentaAction({ ventaId, input });
			if (r.success) {
				toast.success('Pedido facturado correctamente');
				setFacturarOpen(false);
				router.refresh();
			} else {
				toast.error(r.error?.message || 'No se pudo facturar el pedido');
			}
		} catch {
			toast.error('Error de red al facturar el pedido');
		} finally {
			setIsPending(false);
		}
	};

	if (estado === 'PEDIDO') {
		return (
			<Button
				variant="outline"
				className="h-8 w-8 p-0"
				aria-label={`Entregar pedido ${ventaId}`}
				title="Entregar pedido (descuenta stock)"
				disabled={isPending}
				onClick={handleEntregar}
			>
				{isPending ? (
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				) : (
					<PackageCheck className="h-4 w-4" aria-hidden="true" />
				)}
			</Button>
		);
	}

	if (estado !== 'ENTREGADA') return null;

	return (
		<>
			<Button
				variant="outline"
				className="h-8 w-8 p-0"
				aria-label={`Facturar venta ${ventaId}`}
				title="Facturar pedido (genera factura y cobro)"
				disabled={isPending}
				onClick={() => setFacturarOpen(true)}
			>
				<FileText className="h-4 w-4" aria-hidden="true" />
			</Button>
			<Dialog open={facturarOpen} onOpenChange={(v) => { setFacturarOpen(v); if (!v) { setMetodoPago('EFECTIVO'); setFechaVencimiento(''); } }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Facturar pedido</DialogTitle>
						<DialogDescription>
							Se emitirá la factura por {formatCurrency(total)} y se registrará el cobro.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="grid gap-2">
							<label htmlFor="metodo-pago" className="text-sm font-medium">
								Método de pago
							</label>
							<Select value={metodoPago} onValueChange={setMetodoPago}>
								<SelectTrigger id="metodo-pago">
									<SelectValue placeholder="Seleccione el método de pago" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="EFECTIVO">Efectivo</SelectItem>
									<SelectItem value="TARJETA">Tarjeta</SelectItem>
									<SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
									<SelectItem value="CREDITO">Crédito</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{metodoPago === 'CREDITO' && (
							<div className="grid gap-2">
								<label htmlFor="fecha-vencimiento" className="text-sm font-medium">
									Fecha de vencimiento
								</label>
								<Input
									id="fecha-vencimiento"
									type="date"
									value={fechaVencimiento}
									onChange={(e) => setFechaVencimiento(e.target.value)}
								/>
							</div>
						)}
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => setFacturarOpen(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button onClick={handleFacturar} disabled={isPending || (metodoPago === 'CREDITO' && !fechaVencimiento)}>
							{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Facturar
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
