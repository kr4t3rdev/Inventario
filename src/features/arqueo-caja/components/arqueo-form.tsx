/**
 * @description Pantalla/diálogo completo de arqueo de caja.
 * Muestra el conteo de billetes (CUP + USD) y el resumen de diferencias,
 * y permite confirmar o forzar el arqueo.
 *
 * @param {object} props - Props del componente
 * @param {boolean} props.open - Estado del diálogo
 * @param {function} props.onOpenChange - Callback para cambio de estado
 * @param {string} props.turnoId - ID del turno a arquear
 * @param {function} props.onSuccess - Callback al arqueo exitoso
 * @returns {JSX.Element} Formulario de arqueo
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ConteoBilletes } from "./conteo-billetes";
import { ResumenDiferencias } from "./resumen-diferencias";
import {
	DENOMINACIONES_CUP,
	DENOMINACIONES_USD,
	type Denominacion,
} from "./denominaciones";
import {
	getEsperadosArqueoAction,
	realizarArqueoAction,
} from "@/features/arqueo-caja/actions";
import type { EsperadosArqueo } from "@/features/arqueo-caja/types";

const UMBRAL_ADVERTENCIA = 50000; // $500.00 CUP en centavos

interface ArqueoFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	turnoId: string;
	onSuccess?: () => void;
	/** Texto personalizado para el botón de submit. Default: "Registrar arqueo" / "Confirmar arqueo" */
	submitLabel?: string;
}

export function ArqueoForm({
	open,
	onOpenChange,
	turnoId,
	onSuccess,
	submitLabel,
}: ArqueoFormProps) {
	const [esperados, setEsperados] = useState<EsperadosArqueo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [observaciones, setObservaciones] = useState("");

	// Conteo CUP
	const [valoresCup, setValoresCup] = useState<Record<string, number>>({});
	// Conteo USD
	const [valoresUsd, setValoresUsd] = useState<Record<string, number>>({});

	// Cargar esperados al abrir
	useEffect(() => {
		if (!open || !turnoId) return;

		const load = async () => {
			setIsLoading(true);
			try {
				const result = await getEsperadosArqueoAction(turnoId);
				if (result.success && result.data) {
					setEsperados(result.data);
				} else {
					toast.error(result.error?.message ?? "Error al cargar esperados");
				}
			} catch {
				toast.error("Error al cargar datos del arqueo");
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [open, turnoId]);

	// Inicializar/resetear valores
	const resetValores = useCallback(() => {
		const initCup: Record<string, number> = {};
		const initUsd: Record<string, number> = {};

		for (const d of DENOMINACIONES_CUP) initCup[d.key] = 0;
		for (const d of DENOMINACIONES_USD) initUsd[d.key] = 0;

		setValoresCup(initCup);
		setValoresUsd(initUsd);
		setObservaciones("");
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

	/** Calcula total desde denominaciones y valores */
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
		try {
			const result = await realizarArqueoAction({
				turnoId,
				...valoresCup,
				...valoresUsd,
				totalTarjeta: esperados?.esperadoTarjeta ?? 0,
				totalTransferencia: esperados?.esperadoTransferencia ?? 0,
				totalCredito: esperados?.esperadoCredito ?? 0,
				observaciones: observaciones || null,
			});

			if (result.success) {
				toast.success("Arqueo registrado exitosamente");
				// El padre maneja cierre y apertura de siguiente diálogo vía onSuccess
				onSuccess?.();
			} else {
				toast.error(result.error?.message ?? "Error al registrar arqueo");
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Error al registrar arqueo",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const netoCup = totalCup - (esperados?.fondoInicialCup ?? 0);
	const diffCup = netoCup - (esperados?.esperadoEfectivoCup ?? 0);
	const diffUsd = totalUsd - (esperados?.esperadoEfectivoUsd ?? 0);
	const tieneAdvertencia =
		Math.abs(diffCup) > UMBRAL_ADVERTENCIA ||
		Math.abs(diffUsd) > UMBRAL_ADVERTENCIA;

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

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : !esperados ? (
					<div className="flex items-center justify-center py-12 text-muted-foreground">
						No se pudieron cargar los datos del turno
					</div>
				) : (
					<ScrollArea className="max-h-[60vh] pr-2">
						<div className="space-y-4 py-2">
							{/* Conteo CUP */}
							<ConteoBilletes
								moneda="CUP"
								denominaciones={DENOMINACIONES_CUP}
								valores={valoresCup}
								onChange={handleCambioCup}
								totalCalculado={totalCup}
								esperado={esperados.esperadoEfectivoCup}
								fondoInicial={esperados.fondoInicialCup}
								disabled={isSubmitting}
							/>

							{/* Conteo USD */}
							<ConteoBilletes
								moneda="USD"
								denominaciones={DENOMINACIONES_USD}
								valores={valoresUsd}
								onChange={handleCambioUsd}
								totalCalculado={totalUsd}
								esperado={esperados.esperadoEfectivoUsd}
								fondoInicial={esperados.fondoInicialUsd}
								disabled={isSubmitting}
							/>

							{/* Resumen diferencias */}
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

							<Separator />

							{/* Observaciones */}
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

							{/* Advertencia si hay diferencia grande */}
							{tieneAdvertencia && (
								<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 flex items-start gap-3">
									<AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
									<div className="text-sm text-amber-800 dark:text-amber-300">
										<p className="font-medium">Diferencia significativa</p>
										<p className="mt-1">
											La diferencia en CUP es de{" "}
											<strong>
												{diffCup >= 0 ? "+" : ""}${(diffCup / 100).toFixed(2)}
											</strong>
											. Si persiste, verifique el conteo o registre la
											diferencia en observaciones.
										</p>
									</div>
								</div>
							)}
						</div>
					</ScrollArea>
				)}

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
						disabled={isLoading || !esperados || isSubmitting}
						className="gap-1.5"
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<CheckCircle2 className="h-4 w-4" />
						)}
						{submitLabel ??
							(tieneAdvertencia ? "Confirmar arqueo" : "Registrar arqueo")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
