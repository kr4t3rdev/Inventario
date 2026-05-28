/**
 * @description Dialog para reabrir un período contable aprobado.
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type {
	TipoPeriodo,
	EstadoPeriodo,
} from "@/lib/services/periodo-contable-types";

interface ReabrirPeriodoDialogProps {
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

export function ReabrirPeriodoDialog({
	open,
	onOpenChange,
	onSuccess,
	periodo,
}: ReabrirPeriodoDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [motivo, setMotivo] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!periodo) return;

		if (motivo.trim().length < 10) {
			setError("El motivo debe tener al menos 10 caracteres");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			const { reabrirPeriodoAction } = await import(
				"@/features/contabilidad/actions-periodos"
			);
			const result = await reabrirPeriodoAction({
				periodoId: periodo.periodoId,
				motivo: motivo.trim(),
			});

			if (!result.success) {
				setError(result.error?.message ?? "Error al reabrir período");
				return;
			}

			onSuccess();
			onOpenChange(false);
			setMotivo("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error inesperado");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = (open: boolean) => {
		if (!open) setMotivo("");
		onOpenChange(open);
	};

	if (!periodo) return null;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Reabrir Período Contable</DialogTitle>
					<DialogDescription>
						Se registrará en auditoría con el motivo proporcionado.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
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

					<div className="space-y-2">
						<Label htmlFor="motivo">
							Motivo de la Reapertura{" "}
							<span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="motivo"
							value={motivo}
							onChange={(e) => setMotivo(e.target.value)}
							placeholder="Describa el motivo de la reapertura (mínimo 10 caracteres)..."
							rows={4}
							required
						/>
						<p className="text-xs text-muted-foreground">
							{motivo.length}/10 caracteres mínimo
						</p>
					</div>

					<div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-amber-800">
							<p>La reapertura genera un registro de auditoría permanente.</p>
							<p className="mt-1">
								Solo se permite en períodos en estado APROBADO o CERRADO.
							</p>
						</div>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleClose(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={isLoading || motivo.trim().length < 10}
						>
							{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Reabrir Período
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
