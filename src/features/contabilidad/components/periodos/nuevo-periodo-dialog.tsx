"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModoContable } from "@/lib/services/periodo-contable-types";

interface NuevoPeriodoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

/**
 * @description Crea un período normal y deriva automáticamente su apertura desde el cierre anterior.
 * @param {NuevoPeriodoDialogProps} props - Estado del diálogo y callbacks de cierre y éxito.
 * @returns {JSX.Element} Formulario de apertura con continuidad de saldos.
 */
export function NuevoPeriodoDialog({ open, onOpenChange, onSuccess }: NuevoPeriodoDialogProps) {
	const [tipo, setTipo] = useState("MENSUAL");
	const [categoria, setCategoria] = useState("ORDINARIO");
	const [modoContable, setModoContable] = useState<ModoContable>(ModoContable.CAJA);
	const [fechaInicio, setFechaInicio] = useState("");
	const [fechaFin, setFechaFin] = useState("");
	const [observaciones, setObservaciones] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const reset = () => {
		setTipo("MENSUAL");
		setCategoria("ORDINARIO");
		setModoContable(ModoContable.CAJA);
		setFechaInicio("");
		setFechaFin("");
		setObservaciones("");
		setError("");
	};

	const handleOpen = async () => {
		setLoading(true);
		setError("");
		try {
			const { abrirPeriodoAction } = await import("@/features/contabilidad/actions-periodos");
			const result = await abrirPeriodoAction({
				tipo: tipo as "DIARIO" | "MENSUAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL",
				fechaInicio: new Date(`${fechaInicio}T00:00:00.000Z`).toISOString(),
				fechaFin: new Date(`${fechaFin}T23:59:59.999Z`).toISOString(),
				categoria: categoria as "ORDINARIO" | "EXTRAORDINARIO" | "RECTIFICATIVO",
				modoContable,
				observaciones: observaciones.trim() || undefined,
			});
			if (!result.success) throw new Error(result.error?.message ?? "No se pudo abrir el período");
			onSuccess();
			reset();
			onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "No se pudo abrir el período");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Nuevo período contable</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<p className="rounded border bg-muted/30 p-3 text-sm">
						La apertura se deriva del cierre anterior. El sistema mantiene la continuidad de
						CxC, CxP, bancos y demás saldos auxiliares verificados.
					</p>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1">
							<Label htmlFor="nuevo-periodo-tipo">Tipo de período</Label>
							<select id="nuevo-periodo-tipo" className="w-full rounded border p-2" value={tipo} onChange={(event) => setTipo(event.target.value)}>
								{["DIARIO", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].map((value) => <option key={value}>{value}</option>)}
							</select>
						</div>
						<div className="space-y-1">
							<Label htmlFor="nuevo-periodo-categoria">Categoría</Label>
							<select id="nuevo-periodo-categoria" className="w-full rounded border p-2" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
								{["ORDINARIO", "EXTRAORDINARIO", "RECTIFICATIVO"].map((value) => <option key={value}>{value}</option>)}
							</select>
						</div>
						<div className="space-y-1">
							<Label htmlFor="nuevo-periodo-inicio">Fecha de inicio</Label>
							<Input id="nuevo-periodo-inicio" type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
						</div>
						<div className="space-y-1">
							<Label htmlFor="nuevo-periodo-fin">Fecha de fin</Label>
							<Input id="nuevo-periodo-fin" type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
						</div>
						<div className="space-y-1">
							<Label htmlFor="nuevo-periodo-modo">Modo contable</Label>
							<select id="nuevo-periodo-modo" className="w-full rounded border p-2" value={modoContable} onChange={(event) => setModoContable(event.target.value as ModoContable)}>
								{Object.values(ModoContable).map((value) => <option key={value}>{value}</option>)}
							</select>
						</div>
					</div>
					<div className="space-y-1">
						<Label htmlFor="nuevo-periodo-observaciones">Observaciones</Label>
						<Textarea id="nuevo-periodo-observaciones" maxLength={500} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
					</div>
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
					<Button type="button" onClick={handleOpen} disabled={loading || !fechaInicio || !fechaFin}>
						{loading ? "Abriendo…" : "Abrir período y trasladar saldos"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
