'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { createVentaAction } from '@/features/ventas/actions';
import { getPuntosDeVentaAction } from '@/features/puntos-venta/actions';
import { getClientesAction } from '@/features/clientes/actions';
import { getProductosPorUbicacion } from '@/app/actions/productos-ubicacion';
import { getPrecioEfectivo } from '@/lib/types/pricing';
import { formatCurrency } from '@/lib/utils';
import type { ProductoConStock } from '@/lib/api/productos-ubicacion';

interface ItemPedido {
	productoId: string;
	cantidad: number;
}

interface NuevoPedidoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * @description Diálogo para crear un pedido de venta (PVE): la venta nace en
 * estado PEDIDO sin descontar stock ni cobrar; la caja y el cobro se gestionan
 * luego con las acciones Entregar y Facturar.
 * @param {NuevoPedidoDialogProps} props - Control de apertura del diálogo.
 * @returns {JSX.Element} Diálogo de creación de pedido.
 */
export function NuevoPedidoDialog({ open, onOpenChange }: NuevoPedidoDialogProps) {
	const router = useRouter();
	const [puntosVenta, setPuntosVenta] = useState<{ pvId: string; nombre: string }[]>([]);
	const [clientes, setClientes] = useState<{ clienteId: string; nombre: string; listaPrecioId?: string | null }[]>([]);
	const [productos, setProductos] = useState<ProductoConStock[]>([]);
	const [pvId, setPvId] = useState('');
	const [clienteId, setClienteId] = useState('');
	const [items, setItems] = useState<ItemPedido[]>([]);
	const [descuento, setDescuento] = useState(0);
	const [observaciones, setObservaciones] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		getPuntosDeVentaAction().then((r) => {
			if (r.success) setPuntosVenta((r.data as { pvId: string; nombre: string }[]) ?? []);
		});
		getClientesAction().then((r) => {
			if (r.success) setClientes(r.data ?? []);
		});
	}, [open]);

	useEffect(() => {
		if (!open || !pvId) return;
		getProductosPorUbicacion(pvId, clienteId || undefined)
			.then(setProductos)
			.catch(() => {
				setProductos([]);
				toast.error('No se pudieron cargar los productos del punto de venta');
			});
	}, [open, pvId, clienteId]);

	const cliente = clientes.find((c) => c.clienteId === clienteId);
	const precioDe = useCallback(
		(p: ProductoConStock) =>
			cliente?.listaPrecioId ? getPrecioEfectivo(p, cliente.listaPrecioId) : p.precioVentaResuelto,
		[cliente],
	);

	const total = useMemo(
		() =>
			items.reduce((acc, item) => {
				const p = productos.find((x) => x.id === item.productoId);
				return acc + (p ? precioDe(p) * item.cantidad : 0);
			}, 0) - descuento,
		[items, productos, descuento, precioDe],
	);

	const agregarItem = () => setItems((prev) => [...prev, { productoId: '', cantidad: 1 }]);
	const actualizarItem = (index: number, patch: Partial<ItemPedido>) =>
		setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
	const quitarItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

	const handleSubmit = async () => {
		if (!pvId) return toast.error('Seleccione un punto de venta');
		if (items.length === 0 || items.some((i) => !i.productoId)) {
			return toast.error('Agregue al menos un producto al pedido');
		}
		setIsSaving(true);
		try {
			const r = await createVentaAction({
				puntoDeVentaId: pvId,
				clienteId: clienteId || null,
				items: items.map((item) => {
					const p = productos.find((x) => x.id === item.productoId);
					return {
						productoId: item.productoId,
						cantidad: item.cantidad,
						precioUnitario: p ? precioDe(p) : 0,
					};
				}),
				descuento,
				cargoTransporte: 0,
				observaciones: observaciones || null,
				modoPedido: true,
			});
			if (r.success) {
				toast.success('Pedido creado. Entréguelo cuando la mercancía salga.');
				onOpenChange(false);
				setItems([]);
				setObservaciones('');
				setDescuento(0);
				router.refresh();
			} else {
				toast.error(r.error?.message || 'No se pudo crear el pedido');
			}
		} catch {
			toast.error('Error de red al crear el pedido');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Nuevo pedido</DialogTitle>
					<DialogDescription>
						El pedido se registra sin descontar stock ni cobrar. Use "Entregar" y "Facturar" después.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<label className="text-sm font-medium" htmlFor="pedido-pv">Punto de venta</label>
							<Select value={pvId} onValueChange={setPvId}>
								<SelectTrigger id="pedido-pv"><SelectValue placeholder="Seleccione punto de venta" /></SelectTrigger>
								<SelectContent>
									{puntosVenta.map((pv) => (
										<SelectItem key={pv.pvId} value={pv.pvId}>{pv.nombre}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<label className="text-sm font-medium" htmlFor="pedido-cliente">Cliente (opcional)</label>
							<Select value={clienteId || '__none__'} onValueChange={(v) => setClienteId(v === '__none__' ? '' : v)}>
								<SelectTrigger id="pedido-cliente"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">Sin cliente</SelectItem>
									{clientes.map((c) => (
										<SelectItem key={c.clienteId} value={c.clienteId}>{c.nombre}</SelectItem>
									))}
								</SelectContent>
							</Select>
							{!clienteId && (
								<p className="text-xs text-amber-600 dark:text-amber-400">
									Sin cliente asociado el pedido podrá entregarse, pero no facturarse.
								</p>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Productos</span>
							<Button type="button" variant="outline" size="sm" onClick={agregarItem} disabled={!pvId}>
								<Plus className="mr-1 h-4 w-4" /> Agregar
							</Button>
						</div>
						{items.map((item, index) => (
							<div key={index} className="flex items-center gap-2">
								<Select
									value={item.productoId}
									onValueChange={(v) => actualizarItem(index, { productoId: v })}
								>
									<SelectTrigger className="flex-1"><SelectValue placeholder="Producto" /></SelectTrigger>
									<SelectContent>
										{productos.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.nombre} — {formatCurrency(precioDe(p))}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Input
									type="number"
									min={1}
									className="w-24"
									value={item.cantidad}
									onChange={(e) => actualizarItem(index, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
									aria-label={`Cantidad del producto ${index + 1}`}
								/>
								<Button type="button" variant="ghost" size="icon" onClick={() => quitarItem(index)} aria-label="Quitar producto">
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<label className="text-sm font-medium" htmlFor="pedido-descuento">Descuento</label>
							<Input
								id="pedido-descuento"
								type="number"
								min={0}
								value={descuento}
								onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
							/>
						</div>
						<div className="text-right">
							<span className="text-sm text-muted-foreground">Total del pedido</span>
							<p className="text-xl font-semibold">{formatCurrency(Math.max(total, 0))}</p>
						</div>
					</div>

					<Textarea
						placeholder="Observaciones (opcional)"
						value={observaciones}
						onChange={(e) => setObservaciones(e.target.value)}
						maxLength={500}
					/>
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={isSaving}>
						{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Crear pedido
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
