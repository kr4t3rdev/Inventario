/**
 * @description Diálogo de cierre de turno. Punto de entrada al flujo:
 * muestra resumen del turno y permite ir al arqueo de caja.
 * El cuadre se realiza en la página dedicada.
 *
 * @param {object} props - Props del componente
 * @param {boolean} props.open - Estado del diálogo
 * @param {function} props.onOpenChange - Callback para cambio de estado
 * @param {number} props.totalVentas - Total de ventas del turno (en pesos)
 * @param {number} props.totalTickets - Cantidad de tickets
 * @param {function} props.onIrAArqueo - Callback para ir a arqueo
 * @returns {JSX.Element} Diálogo de cierre de turno
 */
"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, CalendarCheck, Calculator } from "lucide-react";

interface CierreTurnoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	totalVentas: number;
	totalTickets: number;
	onIrAArqueo?: () => void;
}

export function CierreTurnoDialog({
	open,
	onOpenChange,
	totalVentas,
	totalTickets,
	onIrAArqueo,
}: CierreTurnoDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CalendarCheck className="h-5 w-5 text-amber-600" />
						Cierre de Turno
					</DialogTitle>
					<DialogDescription>
						Revise el resumen antes de iniciar el cierre
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

				{/* Mensaje informativo */}
				<div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 flex items-start gap-3">
					<Calculator className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
					<div className="text-sm text-blue-800 dark:text-blue-300">
						<p className="font-medium">Antes del cuadre</p>
						<p className="mt-1">
							Es necesario contar el efectivo en caja. Luego podrá revisar el
							cuadre completo con gráficos y productos desde la página de
							cuadre.
						</p>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					{onIrAArqueo && (
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
