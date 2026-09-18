'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import {
	getCliente360Action,
	addNotaClienteAction,
} from '@/features/clientes/actions-360';

interface Nota {
	id: string;
	texto: string;
	causa?: string | null;
	createdAt: string;
}

/**
 * @description Vista operativa del cliente: nombre, compras hechas, CxC viva,
 * anticipos y notas de contacto recientes. Pendiente en CRUD: edición del
 * límite de crédito queda fuera (vendedor no edita el tope).
 * @param {{ clienteId: string }} props - ID del cliente.
 * @returns {JSX.Element | null} El panel 360 o nada mientras carga.
 */
export function Cliente360({ clienteId }: { clienteId: string }) {
	const [data, setData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [notaNueva, setNotaNueva] = useState('');
	const [causa, setCausa] = useState('cobro');
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setIsLoading(true);
		getCliente360Action(clienteId)
			.then((r) => {
				if (r.success) setData(r.data);
				else toast.error(r.error?.message || 'No se pudo cargar el cliente');
			})
			.catch(() => toast.error('Error de red al cargar el cliente'))
			.finally(() => setIsLoading(false));
	}, [clienteId]);

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}
	if (!data) return null;

	// Helpers locales (solo para mostrar)
	const cliente = data;
	const ventasVivas = cliente.Venta?.filter((v: any) => v.estado !== 'ANULADA') ?? [];
	const totalComprado = ventasVivas.reduce((acc: number, v: any) => acc + (v.total ?? 0), 0);
	const saldoCxc = (cliente.cuentasPorCobrar ?? []).reduce(
		(acc: number, c: any) => acc + Math.max(Number(c.montoDeuda) - Number(c.montoPagado), 0),
		0,
	);
	const saldoAnticipado = (cliente.anticipos ?? []).reduce(
		(acc: number, a: any) => acc + Number(a.saldoDisponible ?? 0),
		0,
	);
	const limite = cliente.limiteCredito ?? null;

	const registrarNota = async () => {
		if (notaNueva.trim().length < 2) {
			toast.error('La nota no puede estar vacía');
			return;
		}
		setIsSaving(true);
		try {
			const r = await addNotaClienteAction({
				clienteId,
				texto: notaNueva,
				causa: causa === 'ninguna' ? null : causa,
			});
			if (r.success) {
				toast.success('Nota registrada');
				setNotaNueva('');
				const r2 = await getCliente360Action(clienteId);
				if (r2.success) setData(r2.data);
			} else {
				toast.error(r.error?.message || 'No se pudo registrar la nota');
			}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Card className="mt-6">
			<CardHeader>
				<CardTitle className="text-base">Vista 360 del cliente</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 md:grid-cols-[2fr_1fr]">
				<div className="space-y-3 text-sm">
					<p>
						Compras registradas: <strong>{ventasVivas.length}</strong> · comprado{' '}
						<strong>{formatCurrency(totalComprado)}</strong>
					</p>
					<p>
						Deuda viva: <strong>{formatCurrency(saldoCxc)}</strong>
					</p>
					<p>
						Saldo anticipado disponible:{' '}
						<strong>{formatCurrency(saldoAnticipado)}</strong>
					</p>
					{limite != null && (
						<p className="rounded-md border px-2 py-1 text-sm">
							Límite de crédito: <strong>{formatCurrency(limite)}</strong>
							{saldoCxc > limite && (
								<span className="ml-2 text-destructive">excedido</span>
							)}
						</p>
					)}
					<div className="pt-2">
						<p className="mb-1 text-xs font-medium text-muted-foreground">
							Últimas notas ({cliente.notasContacto?.length ?? 0}):
						</p>
						<ul className="space-y-1 text-xs text-muted-foreground">
							{(cliente.notasContacto ?? []).map((n: Nota) => (
								<li key={n.id} className="border-l-2 pl-2">
									<span className="font-medium">{n.causa ?? 'nota'}</span> — {n.texto}
								</li>
							))}
						</ul>
					</div>
				</div>
				<div className="space-y-3 rounded-md border p-3">
					<p className="text-sm font-medium">Registrar nota rápida</p>
					<Textarea
						placeholder="Nota para el equipo (llamada, propuesta, ajuste…)"
						value={notaNueva}
						onChange={(e) => setNotaNueva(e.target.value)}
					/>
					<div className="flex items-center gap-2">
						<Select value={causa} onValueChange={setCausa}>
							<SelectTrigger className="flex-1">
								<SelectValue placeholder="Motivo (opcional)" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="cobro">Seguimiento de cobro</SelectItem>
								<SelectItem value="llamada">Llamada</SelectItem>
								<SelectItem value="ninguna">Sin clasificar</SelectItem>
							</SelectContent>
						</Select>
						<Button
							type="button"
							size="sm"
							onClick={registrarNota}
							disabled={isSaving}
						>
							Guardar
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
