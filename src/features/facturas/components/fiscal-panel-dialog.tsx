'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { FiscalBadge } from './fiscal-badge';
import {
	getDocumentoFiscalAction,
	reintentarFiscalAction,
} from '@/features/facturas/actions-fiscal';

interface EventoFiscal {
	estado: string;
	detalle: unknown;
	createdAt: string | Date;
}

interface FiscalPanelDialogProps {
	facturaId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * @description Panel del documento fiscal de una factura (Gap 4): estado, uuid,
 * bitácora de eventos y reintento cuando está rechazado.
 * @param {FiscalPanelDialogProps} props - Factura y control del diálogo.
 * @returns {JSX.Element} Diálogo con el detalle fiscal.
 */
export function FiscalPanelDialog({ facturaId, open, onOpenChange }: FiscalPanelDialogProps) {
	const [estado, setEstado] = useState<string | null>(null);
	const [uuid, setUuid] = useState<string | null>(null);
	const [eventos, setEventos] = useState<EventoFiscal[]>([]);
	const [ultimoError, setUltimoError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isRetrying, setIsRetrying] = useState(false);

	useEffect(() => {
		if (!open || !facturaId) return;
		setIsLoading(true);
		getDocumentoFiscalAction(facturaId)
			.then((r) => {
				if (!r.success) {
					toast.error(r.error?.message || 'Sin documento fiscal para esta factura');
					setEstado(null);
					setEventos([]);
					return;
				}
				if (r.data) {
					setEstado(r.data.estado);
					setUuid(r.data.uuidExterno ?? null);
					setEventos((r.data.eventos as EventoFiscal[]) ?? []);
					setUltimoError(r.data.ultimoError ?? null);
				}
			})
			.finally(() => setIsLoading(false));
	}, [open, facturaId]);

	const reintentar = async () => {
		if (!facturaId) return;
		setIsRetrying(true);
		try {
			const r = await reintentarFiscalAction(facturaId);
			if (!r.success) {
				toast.error(r.error?.message || 'No se pudo reintentar');
				return;
			}
			toast.success('Documento reencolado');
			if (r.data?.estado) setEstado(r.data.estado);
		} catch {
			toast.error('Error de red al reintentar');
		} finally {
			setIsRetrying(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Documento fiscal</DialogTitle>
					<DialogDescription>
						Estado y bitácora de eventos de la emisión fiscal de esta factura.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex justify-center py-6">
						<Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" />
					</div>
				) : estado == null ? (
					<p className="text-sm text-muted-foreground">
						Esta factura no tiene documento fiscal emitido.
					</p>
				) : (
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<FiscalBadge estado={estado} />
							{uuid && (
								<span className="text-xs text-muted-foreground font-mono">{uuid}</span>
							)}
						</div>
						{ultimoError && (
							<p className="text-xs text-destructive">Último error: {ultimoError}</p>
						)}
						<ul className="max-h-48 space-y-1 overflow-auto text-xs">
							{eventos.map((e, i) => (
								<li key={i} className="flex justify-between border-b pb-1">
									<span>{e.estado}</span>
									<span className="text-muted-foreground">
										{new Date(e.createdAt).toLocaleString()}
									</span>
								</li>
							))}
						</ul>
						{estado === 'RECHAZADA' && (
							<div className="flex justify-end">
								<Button size="sm" onClick={reintentar} disabled={isRetrying}>
									{isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									Reintentar emisión
								</Button>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
