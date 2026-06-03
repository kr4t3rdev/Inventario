/**
 * @description Dialog para cerrar un período contable.
 *
 * Muestra un resumen del período y un botón que navega a la página de cuadre
 * completo. El cierre se realiza desde la página de cuadre.
 */
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type {
	TipoPeriodo,
	EstadoPeriodo,
} from "@/lib/services/periodo-contable-types";

interface CerrarPeriodoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	periodo: {
		periodoId: string;
		tipo: TipoPeriodo;
		estado: EstadoPeriodo;
		fechaInicio: Date | string;
		fechaFin: Date | string;
		codigoPeriodo?: string;
	} | null;
}

const TIPO_LABELS: Record<string, string> = {
	DIARIO: "Diario",
	MENSUAL: "Mensual",
	TRIMESTRAL: "Trimestral",
	SEMESTRAL: "Semestral",
	ANUAL: "Anual",
};

export function CerrarPeriodoDialog({
	open,
	onOpenChange,
	onSuccess,
	periodo,
}: CerrarPeriodoDialogProps) {
	const router = useRouter();

	if (!periodo) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Cerrar Período Contable</DialogTitle>
					<DialogDescription>
						Revise el cuadre completo antes de confirmar el cierre.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="bg-muted/50 rounded-lg p-4 space-y-2">
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">Período</span>
							<Badge variant="outline">
								{TIPO_LABELS[periodo.tipo] ?? periodo.tipo}
							</Badge>
						</div>
						<div className="text-sm font-medium">
							{periodo.codigoPeriodo ??
								format(new Date(periodo.fechaInicio), "dd/MM/yyyy")}
						</div>
						<div className="text-sm text-muted-foreground">
							{format(new Date(periodo.fechaInicio), "dd/MM/yyyy")} —{" "}
							{format(new Date(periodo.fechaFin), "dd/MM/yyyy")}
						</div>
					</div>

					<div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-blue-800">
							<p className="font-medium">Revise el cuadre antes de cerrar</p>
							<p className="mt-1">
								Se mostrará el balance, operaciones, ventas vs reconciliado,
								resumen diario y gráficos financieros.
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-amber-800">
							<p className="font-medium">
								Una vez cerrado, el período no aceptará nuevas operaciones
								contables.
							</p>
							<p className="mt-1">
								Se validará que no queden ventas, servicios o gastos sin
								reconciliar.
							</p>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						onClick={() => {
							onOpenChange(false);
							router.push(
								`/busy/contabilidad/periodos/${periodo.periodoId}/cuadre`,
							);
						}}
					>
						<ExternalLink className="h-4 w-4 mr-2" />
						Ir al Cuadre
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
