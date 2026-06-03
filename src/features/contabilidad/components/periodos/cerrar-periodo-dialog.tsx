/**
 * @description Dialog para cerrar un período contable.
 *
 * Muestra un resumen del período y un botón que abre el modal de cuadre
 * completo. El cierre real se ejecuta desde CuadrePeriodoModal.
 */
"use client";

import { useState } from "react";
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
import { AlertTriangle, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { CuadrePeriodoModal } from "./cuadre-periodo-modal";
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
	const [showCuadre, setShowCuadre] = useState(false);

	if (!periodo) return null;

	return (
		<>
			<Dialog open={open && !showCuadre} onOpenChange={onOpenChange}>
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
									Se mostrará el balance, operaciones, ventas vs reconciliado y
									resumen diario del período.
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
									Podrá ser reabierto posteriormente con motivo justificado.
								</p>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancelar
						</Button>
						<Button onClick={() => setShowCuadre(true)}>
							<BarChart3 className="h-4 w-4 mr-2" />
							Ver Cuadre y Cerrar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<CuadrePeriodoModal
				open={showCuadre}
				onOpenChange={(v) => {
					setShowCuadre(v);
					if (!v) onOpenChange(false);
				}}
				onSuccess={onSuccess}
				periodoId={periodo.periodoId}
			/>
		</>
	);
}
