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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { FiscalBadge } from './fiscal-badge';
import {
	conciliarFiscalAction,
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
 * @description Panel del documento fiscal de una factura (Gap 4 / Phase 5):
 * estado, uuid, bitácora de eventos y, sólo para el operador autorizado, el
 * reintento con prueba de no emisión (RECHAZADA) o la conciliación con
 * evidencia externa (INCIERTA). Los inciertos nunca ofrecen reenvío directo.
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
	const [pruebaNoEmision, setPruebaNoEmision] = useState('');
	const [conciliando, setConciliando] = useState<'TIMBRADA' | 'NO_EMITIDA' | null>(null);
	const [uuidConciliacion, setUuidConciliacion] = useState('');
	const [motivoConciliacion, setMotivoConciliacion] = useState('');

	useEffect(() => {
		if (!open || !facturaId) return;
		setIsLoading(true);
		setPruebaNoEmision('');
		setUuidConciliacion('');
		setMotivoConciliacion('');
		setConciliando(null);
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
		if (!facturaId || !pruebaNoEmision.trim()) {
			toast.error('Adjunta la prueba de que el proveedor no emitió el comprobante.');
			return;
		}
		setIsRetrying(true);
		try {
			const r = await reintentarFiscalAction({
				facturaId,
				pruebaNoEmision: pruebaNoEmision.trim(),
			});
			if (!r.success) {
				toast.error(r.error?.message || 'No se pudo reintentar');
				return;
			}
			toast.success('Documento reencolado con evidencia');
			if (r.data?.estado) setEstado(r.data.estado);
		} catch {
			toast.error('Error de red al reintentar');
		} finally {
			setIsRetrying(false);
		}
	};

	const conciliar = async (resultado: 'TIMBRADA' | 'NO_EMITIDA') => {
		if (!facturaId || !motivoConciliacion.trim()) {
			toast.error('Describe la evidencia externa que respalda la conciliación.');
			return;
		}
		if (resultado === 'TIMBRADA' && !uuidConciliacion.trim()) {
			toast.error('Ingresa el uuid externo del proveedor como evidencia.');
			return;
		}
		setConciliando(resultado);
		try {
			const r = await conciliarFiscalAction({
				facturaId,
				resultado,
				uuidExterno: uuidConciliacion.trim() || undefined,
				motivo: motivoConciliacion.trim(),
			});
			if (!r.success) {
				toast.error(r.error?.message || 'No se pudo conciliar');
				return;
			}
			toast.success(
				resultado === 'TIMBRADA'
					? 'Timbrado confirmado con evidencia, sin nuevo envío'
					: 'No emisión probada: el documento vuelve a la cola',
			);
			if (r.data?.estado) setEstado(r.data.estado);
		} catch {
			toast.error('Error de red al conciliar');
		} finally {
			setConciliando(null);
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
						{estado === 'INCIERTA' && (
							<p role="note" className="rounded border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
								La emisión quedó con resultado externo no verificable. No se reenvía
								sola: un operador autorizado debe conciliar con evidencia del proveedor.
							</p>
						)}
						<ul className="max-h-48 space-y-1 overflow-auto text-xs" aria-label="Bitácora de eventos fiscales">
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
							<div className="space-y-2 rounded border p-2">
								<Label htmlFor="prueba-no-emision" className="text-xs">
									Prueba de no emisión del proveedor (obligatoria para reintentar)
								</Label>
								<Textarea
									id="prueba-no-emision"
									value={pruebaNoEmision}
									onChange={(e) => setPruebaNoEmision(e.target.value)}
									placeholder="Número de caso o acuse del proveedor donde confirma que el comprobante no existe"
									className="text-xs"
									rows={2}
								/>
								<div className="flex justify-end">
									<Button
										size="sm"
										onClick={reintentar}
										disabled={isRetrying || !pruebaNoEmision.trim()}
									>
										{isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
										Reintentar con evidencia
									</Button>
								</div>
							</div>
						)}

						{estado === 'INCIERTA' && (
							<div className="space-y-2 rounded border p-2" aria-label="Conciliación con evidencia">
								<Label htmlFor="motivo-conciliacion" className="text-xs">
									Evidencia externa que respalda la conciliación (obligatoria)
								</Label>
								<Textarea
									id="motivo-conciliacion"
									value={motivoConciliacion}
									onChange={(e) => setMotivoConciliacion(e.target.value)}
									placeholder="Dónde y cómo se verificó el resultado (portal del proveedor, acuse firmado, caso de soporte…)"
									className="text-xs"
									rows={2}
								/>
								<Label htmlFor="uuid-conciliacion" className="text-xs">
									Uuid externo (sólo para confirmar timbrado)
								</Label>
								<Input
									id="uuid-conciliacion"
									value={uuidConciliacion}
									onChange={(e) => setUuidConciliacion(e.target.value)}
									placeholder="Uuid del comprobante en el proveedor"
									className="text-xs font-mono"
								/>
								<div className="flex flex-wrap justify-end gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() => conciliar('NO_EMITIDA')}
										disabled={conciliando !== null || !motivoConciliacion.trim()}
									>
										{conciliando === 'NO_EMITIDA' ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : null}
										Probar no emisión
									</Button>
									<Button
										size="sm"
										onClick={() => conciliar('TIMBRADA')}
										disabled={
											conciliando !== null ||
											!motivoConciliacion.trim() ||
											!uuidConciliacion.trim()
										}
									>
										{conciliando === 'TIMBRADA' ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : null}
										Confirmar timbrado
									</Button>
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
