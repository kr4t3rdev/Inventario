/**
 * @description Diálogo de cierre de turno. Sirve como punto de entrada al flujo
 * de cierre: muestra resumen y permite navegar a arqueo. Si ya hay arqueo,
 * permite cerrar el turno directamente (validación de coincidencia en server).
 *
 * @param {object} props - Props del componente
 * @param {boolean} props.open - Estado del diálogo
 * @param {function} props.onOpenChange - Callback para cambio de estado
 * @param {string} props.turnoId - ID del turno a cerrar
 * @param {number} props.totalVentas - Total de ventas del turno (en pesos)
 * @param {number} props.totalTickets - Cantidad de tickets
 * @param {boolean} props.tieneArqueo - Si el turno tiene arqueo registrado
 * @param {function} props.onSuccess - Callback al cerrar exitosamente
 * @param {function} props.onIrAArqueo - Callback para ir a arqueo
 * @returns {JSX.Element} Diálogo de cierre de turno
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Lock, AlertTriangle, ClipboardList } from "lucide-react";
import { cerrarTurnoAction } from "@/features/turnos-pos/actions";

interface CierreTurnoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	turnoId: string;
	totalVentas: number;
	totalTickets: number;
	tieneArqueo: boolean;
	onSuccess?: () => void;
	onIrAArqueo?: () => void;
}

export function CierreTurnoDialog({
	open,
	onOpenChange,
	turnoId,
	totalVentas,
	totalTickets,
	tieneArqueo,
	onSuccess,
	onIrAArqueo,
}: CierreTurnoDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleCerrar = async () => {
		setIsSubmitting(true);
		try {
			const result = await cerrarTurnoAction({ turnoId });

			if (result.success) {
				toast.success("Turno cerrado exitosamente");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error(result.error?.message ?? "Error al cerrar turno");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Error al cerrar turno");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Lock className="h-5 w-5 text-amber-600" />
						Cerrar Turno
					</DialogTitle>
					<DialogDescription>
						Revise el resumen antes de cerrar el turno
					</DialogDescription>
				</DialogHeader>

				{/* Resumen del turno */}
				<div className="rounded-lg border bg-muted/30 p-4 space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Total ventas</span>
						<span className="font-medium">${totalVentas.toFixed(2)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Tickets emitidos</span>
						<span className="font-medium">{totalTickets}</span>
					</div>
				</div>

				{/* Advertencia si no hay arqueo */}
				{!tieneArqueo && (
					<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 flex items-start gap-3">
						<AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
						<div className="text-sm text-amber-800 dark:text-amber-300">
							<p className="font-medium">Debe realizar el arqueo de caja</p>
							<p className="mt-1">
								Es necesario contar el efectivo antes de cerrar el turno. Use el
								botón "Ir a Arqueo" para comenzar.
							</p>
						</div>
					</div>
				)}

				{/* Si ya hay arqueo: ok para cerrar */}
				{tieneArqueo && (
					<div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3 flex items-start gap-3">
						<Lock className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
						<div className="text-sm text-green-800 dark:text-green-300">
							<p className="font-medium">Arqueo registrado</p>
							<p className="mt-1">
								El turno tiene arqueo y está listo para cerrar.
							</p>
						</div>
					</div>
				)}

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>

					{!tieneArqueo && onIrAArqueo && (
						<Button
							variant="default"
							onClick={() => {
								onOpenChange(false);
								onIrAArqueo();
							}}
							className="gap-1.5"
						>
							<ClipboardList className="h-4 w-4" />
							Ir a Arqueo
						</Button>
					)}

					<Button
						variant="default"
						onClick={handleCerrar}
						disabled={!tieneArqueo || isSubmitting}
						className="gap-1.5"
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Lock className="h-4 w-4" />
						)}
						Cerrar Turno
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
