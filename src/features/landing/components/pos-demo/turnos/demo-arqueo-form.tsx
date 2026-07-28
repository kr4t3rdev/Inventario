'use client';

import { useCallback, useEffect, useState } from 'react';
import {
	AlertTriangle,
	Calculator,
	CheckCircle2,
	Loader2,
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
import { Textarea } from '@/components/ui/textarea';

import { ConteoBilletes } from '@/features/arqueo-caja/components/conteo-billetes';
import { ResumenDiferencias } from '@/features/arqueo-caja/components/resumen-diferencias';
import {
	DENOMINACIONES_CUP,
	DENOMINACIONES_USD,
	type Denominacion,
} from '@/features/arqueo-caja/components/denominaciones';
import type { EsperadosArqueo } from '@/features/arqueo-caja/types';

import type { DemoTurnoActivo } from '@/features/landing/components/pos-demo/mock-data';

const UMBRAL_ADVERTENCIA = 50000; // $500.00 CUP en centavos

export interface DemoArqueoResultado {
	turnoId: string;
	totalEfectivoCup: number;
	totalEfectivoUsd: number;
	totalTarjeta: number;
	totalTransferencia: number;
	totalCredito: number;
	observaciones: string | null;
}

interface DemoArqueoFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	turno: DemoTurnoActivo | null;
	/**
	 * Ventas demo registradas durante el turno, agrupadas por forma de pago.
	 * Cada valor en centavos. Se usan para computar los esperados de arqueo.
	 */
	ventasPorFormaPago: {
		efectivo: number; // monto total de ventas en efectivo CUP (centavos)
		efectivoUsd?: number; // monto total de ventas en efectivo USD (centavos)
		tarjeta: number;
		transferencia: number;
		credito: number;
	};
	submitLabel?: string;
	onSuccess?: (resultado: DemoArqueoResultado) => void;
}

/**
 * @description Formulario demo de arqueo de caja. Replica visual exacta del
 *              `ArqueoForm` real (mismos diálogos, ConteoBilletes y
 *              ResumenDiferencias) pero los "esperados" se calculan desde
 *              el turno demo + ventas registradas en memoria, sin Server Action.
 * @returns {JSX.Element} Formulario de arqueo demo.
 */
export function DemoArqueoForm({
	open,
	onOpenChange,
	turno,
	ventasPorFormaPago,
	submitLabel,
	onSuccess,
}: DemoArqueoFormProps): React.JSX.Element | null {
	const [observaciones, setObservaciones] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [valoresCup, setValoresCup] = useState<Record<string, number>>({});
	const [valoresUsd, setValoresUsd] = useState<Record<string, number>>({});

	const esperados: EsperadosArqueo | null = turno
		? {
				esperadoEfectivoCup: ventasPorFormaPago.efectivo,
				esperadoEfectivoUsd: ventasPorFormaPago.efectivoUsd ?? 0,
				esperadoTarjeta: ventasPorFormaPago.tarjeta,
				esperadoTransferencia: ventasPorFormaPago.transferencia,
				esperadoCredito: ventasPorFormaPago.credito,
				fondoInicialCup: turno.fondoInicialCup,
				fondoInicialUsd: turno.fondoInicialUsd,
				ventasEfectivoCup: ventasPorFormaPago.efectivo,
				ventasEfectivoUsd: ventasPorFormaPago.efectivoUsd ?? 0,
			}
		: null;

	const resetValores = useCallback(() => {
		const initCup: Record<string, number> = {};
		const initUsd: Record<string, number> = {};
		for (const d of DENOMINACIONES_CUP) initCup[d.key] = 0;
		for (const d of DENOMINACIONES_USD) initUsd[d.key] = 0;
		setValoresCup(initCup);
		setValoresUsd(initUsd);
		setObservaciones('');
	}, []);

	useEffect(() => {
		if (open) resetValores();
	}, [open, resetValores]);

	const handleCambioCup = (key: string, value: number) => {
		setValoresCup((prev) => ({ ...prev, [key]: value }));
	};

	const handleCambioUsd = (key: string, value: number) => {
		setValoresUsd((prev) => ({ ...prev, [key]: value }));
	};

	const calcularTotal = (
		denominaciones: Denominacion[],
		valores: Record<string, number>,
	): number => {
		return denominaciones.reduce((sum, d) => {
			const cant = valores[d.key] ?? 0;
			return sum + cant * d.valor;
		}, 0);
	};

	const totalCup = calcularTotal(DENOMINACIONES_CUP, valoresCup);
	const totalUsd = calcularTotal(DENOMINACIONES_USD, valoresUsd);

	const handleSubmit = async () => {
		setIsSubmitting(true);
		// Simula latencia del backend.
		await new Promise((resolve) => setTimeout(resolve, 700));

		const resultado: DemoArqueoResultado = {
			turnoId: turno?.id ?? '',
			totalEfectivoCup: totalCup,
			totalEfectivoUsd: totalUsd,
			totalTarjeta: esperados?.esperadoTarjeta ?? 0,
			totalTransferencia: esperados?.esperadoTransferencia ?? 0,
			totalCredito: esperados?.esperadoCredito ?? 0,
			observaciones: observaciones || null,
		};

		toast.success('Arqueo registrado exitosamente');
		setIsSubmitting(false);
		onOpenChange(false);
		onSuccess?.(resultado);
	};

	const netoCup = totalCup - (esperados?.fondoInicialCup ?? 0);
	const diffCup = netoCup - (esperados?.esperadoEfectivoCup ?? 0);
	const diffUsd = totalUsd - (esperados?.esperadoEfectivoUsd ?? 0);
	const tieneAdvertencia =
		Math.abs(diffCup) > UMBRAL_ADVERTENCIA ||
		Math.abs(diffUsd) > UMBRAL_ADVERTENCIA;

	// El flujo del POS real no muestra el diálogo si no hay turno activo
	// (lo controla el padre con `{turnoActivo && isArqueoDialogOpen && (...)}`)
	if (!turno) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[90vh]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Calculator className="h-5 w-5 text-primary" />
						Arqueo de Caja
					</DialogTitle>
					<DialogDescription>
						Cuente el efectivo en caja y registre los totales por método de pago
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[60vh] pr-2">
					<div className="space-y-4 py-2">
						<ConteoBilletes
							moneda="CUP"
							denominaciones={DENOMINACIONES_CUP}
							valores={valoresCup}
							onChange={handleCambioCup}
							totalCalculado={totalCup}
							esperado={esperados?.esperadoEfectivoCup ?? 0}
							fondoInicial={esperados?.fondoInicialCup ?? 0}
							disabled={isSubmitting}
						/>

						<ConteoBilletes
							moneda="USD"
							denominaciones={DENOMINACIONES_USD}
							valores={valoresUsd}
							onChange={handleCambioUsd}
							totalCalculado={totalUsd}
							esperado={esperados?.esperadoEfectivoUsd ?? 0}
							fondoInicial={esperados?.fondoInicialUsd ?? 0}
							disabled={isSubmitting}
						/>

						{esperados && (
							<ResumenDiferencias
								esperados={esperados}
								contados={{
									totalEfectivoCup: totalCup,
									totalEfectivoUsd: totalUsd,
									totalTarjeta: esperados.esperadoTarjeta,
									totalTransferencia: esperados.esperadoTransferencia,
									totalCredito: esperados.esperadoCredito,
								}}
							/>
						)}

						<Separator />

						<div className="space-y-2">
							<label className="text-sm font-medium">Observaciones</label>
							<Textarea
								placeholder="Opcional — notas sobre diferencias o incidencias"
								value={observaciones}
								onChange={(e) => setObservaciones(e.target.value)}
								disabled={isSubmitting}
								rows={2}
							/>
						</div>

						{tieneAdvertencia && (
							<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
								<div className="text-sm text-amber-800 dark:text-amber-300">
									<p className="font-medium">Diferencia significativa</p>
									<p className="mt-1">
										La diferencia en CUP es de{' '}
										<strong>
											{diffCup >= 0 ? '+' : ''}${(diffCup / 100).toFixed(2)}
										</strong>
										. Si persiste, verifique el conteo o registre la diferencia en
										observaciones.
									</p>
								</div>
							</div>
						)}
					</div>
				</ScrollArea>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting}
						className="gap-1.5"
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<CheckCircle2 className="h-4 w-4" />
						)}
						{submitLabel ??
							(tieneAdvertencia ? 'Confirmar arqueo' : 'Registrar arqueo')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
