"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface AperturaManualLinea {
	lineId?: string;
	cuentaCodigo: string;
	moneda: string;
	debito: string;
	credito: string;
	fxEvidenceId?: string;
}

interface AperturaManualLineaValuada extends AperturaManualLinea {
	cuentaContableId: string;
	monedaFuncional: string;
	debitoFuncional: string;
	creditoFuncional: string;
	tasaCambio: string | null;
	fxEvidenceFingerprint: string | null;
	fxEvidence: null | {
		sourceType: string;
		sourceId: string;
		originalAmount: string;
		originalCurrency: string;
		functionalAmount: string;
		functionalCurrency: string;
		rateEffectiveAt: string;
		cutoffAt: string;
		provenance: string;
		source: string;
		fxCatalogRateId: string | null;
		evidenceFingerprint: string;
		evidenceVersion: number;
	};
}

interface SolicitudAperturaSummary {
	solicitudId: string;
	tipo: string;
	fechaInicio: string | Date;
	fechaFin: string | Date;
	functionalCurrencyCode: string;
	estado: "PENDIENTE" | "APROBADA";
	solicitadaPor: string;
	aprobadaPor: string | null;
	createdAt: string | Date;
}

interface AbrirPeriodoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

/**
 * @description Formatea una fecha civil estable usando UTC para evitar cambiar el día por zona local.
 * @param {string | Date} value - Fecha serializada de la solicitud.
 * @returns {string} Fecha civil en formato DD/MM/YYYY.
 */
function formatCivilDate(value: string | Date): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Fecha inválida";
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${date.getUTCFullYear()}`;
}

/**
 * @description Captura el cuadre manual y separa solicitud, aprobación y apertura.
 * @param {AbrirPeriodoDialogProps} props - Estado del diálogo y callback de éxito.
 * @returns {JSX.Element} Formulario de apertura verificable.
 */
export function AbrirPeriodoDialog({ open, onOpenChange, onSuccess }: AbrirPeriodoDialogProps): ReactElement {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [solicitudId, setSolicitudId] = useState("");
	const [estado, setEstado] = useState<"NUEVA" | "PENDIENTE" | "APROBADA">("NUEVA");
	const [previewHash, setPreviewHash] = useState("");
	const [solicitudes, setSolicitudes] = useState<SolicitudAperturaSummary[]>([]);
	const [tipo, setTipo] = useState("MENSUAL");
	const [categoria, setCategoria] = useState("ORDINARIO");
	const [modoContable, setModoContable] = useState("CAJA");
	const [functionalCurrencyCode, setFunctionalCurrencyCode] = useState("");
	const [fechaInicio, setFechaInicio] = useState("");
	const [fechaFin, setFechaFin] = useState("");
	const [observaciones, setObservaciones] = useState("");
	const [lineas, setLineas] = useState<AperturaManualLinea[]>([
		{ cuentaCodigo: "", moneda: "", debito: "0", credito: "0" },
		{ cuentaCodigo: "", moneda: "", debito: "0", credito: "0" },
	]);
	const [lineasValuadas, setLineasValuadas] = useState<AperturaManualLineaValuada[]>([]);
	const pendingRequestKey = useRef<{ payload: string; key: string } | null>(null);

	const loadSolicitudes = useCallback(async () => {
		try {
			const { listarSolicitudesAperturaManualAction } = await import("@/features/contabilidad/actions-periodos");
			const result = await listarSolicitudesAperturaManualAction({});
			if (!result.success) {
				setError(result.error?.message ?? "No se pudieron cargar las solicitudes guardadas.");
				return;
			}
			setSolicitudes(result.data.solicitudes as unknown as SolicitudAperturaSummary[]);
		} catch (cause) {
			setError(cause instanceof Error
				? cause.message
				: "No se pudieron cargar las solicitudes guardadas.");
		}
	}, []);

	const loadFunctionalCurrency = useCallback(async () => {
		try {
			const { getAccountingPolicyStateAction } = await import("@/features/contabilidad/actions-accounting-policy");
			const result = await getAccountingPolicyStateAction();
			const currency = result.success ? result.data.policy?.functionalCurrencyCode : null;
			if (!currency) {
				setError("Configura la moneda funcional contable antes de preparar la apertura.");
				return;
			}
			setFunctionalCurrencyCode(currency);
			setLineas((current) => current.map((line) => ({
				...line,
				moneda: line.moneda || currency,
			})));
		} catch {
			setError("No se pudo cargar la moneda funcional contable.");
		}
	}, []);

	const loadSolicitud = async (id: string) => {
		setLoading(true);
		setError("");
		try {
			const { obtenerSolicitudAperturaManualAction } = await import("@/features/contabilidad/actions-periodos");
			const result = await obtenerSolicitudAperturaManualAction({ solicitudId: id });
			if (!result.success) throw new Error(result.error?.message ?? "No se pudo leer la solicitud");
			const request = result.data.solicitud;
			const lines = request.lineas as unknown as AperturaManualLinea[];
			setLineasValuadas(request.lineasValuadas as unknown as AperturaManualLineaValuada[]);
			setPreviewHash(request.previewHash);
			setSolicitudId(request.solicitudId);
			setEstado(request.estado as "PENDIENTE" | "APROBADA");
			setFunctionalCurrencyCode(request.functionalCurrencyCode);
			setTipo(request.tipo);
			setCategoria(request.categoria ?? "ORDINARIO");
			setModoContable(request.modoContable ?? "CAJA");
			setFechaInicio(new Date(request.fechaInicio).toISOString().slice(0, 10));
			setFechaFin(new Date(request.fechaFin).toISOString().slice(0, 10));
			setObservaciones(request.observaciones ?? "");
			setLineas(lines);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Error inesperado");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (open) {
			void loadSolicitudes();
			void loadFunctionalCurrency();
		}
	}, [open, loadSolicitudes, loadFunctionalCurrency]);

	const runAction = async (operation: "solicitar" | "aprobar" | "abrir") => {
		setLoading(true);
		setError("");
		try {
			const actions = await import("@/features/contabilidad/actions-periodos");
			if (operation === "solicitar") {
				const requestPayload = {
					tipo: tipo as never,
					categoria: categoria as never,
					modoContable: modoContable as never,
					fechaInicio: new Date(`${fechaInicio}T00:00:00.000Z`).toISOString(),
					fechaFin: new Date(`${fechaFin}T23:59:59.999Z`).toISOString(),
					observaciones: observaciones || undefined,
					lineas,
				};
				const serializedPayload = JSON.stringify(requestPayload);
				if (pendingRequestKey.current?.payload !== serializedPayload) {
					pendingRequestKey.current = { payload: serializedPayload, key: crypto.randomUUID() };
				}
				const result = await actions.solicitarAperturaManualAction({
					...requestPayload,
					idempotencyKey: pendingRequestKey.current.key,
				});
				if (!result.success) throw new Error(result.error?.message ?? "No se pudo registrar la solicitud");
				if (!result.data.solicitudId) throw new Error("La solicitud no devolvió identificador");
				setSolicitudId(result.data.solicitudId);
				await loadSolicitud(result.data.solicitudId);
				await loadSolicitudes();
				return;
			}
			if (operation === "aprobar") {
				const result = await actions.aprobarAperturaManualAction({ solicitudId });
				if (!result.success) throw new Error(result.error?.message ?? "No se pudo aprobar el cuadre");
				setEstado("APROBADA");
				await loadSolicitudes();
				return;
			}
			const result = await actions.abrirPeriodoManualAprobadoAction({ solicitudId });
			if (!result.success) throw new Error(result.error?.message ?? "No se pudo abrir el período");
			onSuccess();
			onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Error inesperado");
		} finally {
			setLoading(false);
		}
	};

	const reset = () => {
		setError(""); setSolicitudId(""); setEstado("NUEVA"); setPreviewHash(""); setTipo("MENSUAL");
		setCategoria("ORDINARIO"); setModoContable("CAJA");
		setFechaInicio(""); setFechaFin(""); setObservaciones("");
		setLineas([
			{ cuentaCodigo: "", moneda: functionalCurrencyCode, debito: "0", credito: "0" },
			{ cuentaCodigo: "", moneda: functionalCurrencyCode, debito: "0", credito: "0" },
		]);
		setLineasValuadas([]);
	};

	return <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
		<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
			<DialogHeader><DialogTitle>Apertura contable manual</DialogTitle></DialogHeader>
			{estado === "NUEVA" ? <div className="space-y-4">
				<p className="rounded border bg-muted/30 p-2 text-sm">Moneda funcional: <strong>{functionalCurrencyCode || "No configurada"}</strong></p>
				{solicitudes.length > 0 && <section className="space-y-2 rounded border p-3">
					<h3 className="font-medium">Solicitudes guardadas para revisión</h3>
					<ul className="max-h-40 space-y-1 overflow-y-auto">{solicitudes.map((request) => <li key={request.solicitudId}>
						<Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => void loadSolicitud(request.solicitudId)}>
							{request.estado} · {request.tipo} · {formatCivilDate(request.fechaInicio)}–{formatCivilDate(request.fechaFin)} · {request.functionalCurrencyCode}
						</Button>
					</li>)}</ul>
				</section>}
				<div className="grid grid-cols-3 gap-3">
					<div><Label htmlFor="tipo">Tipo de período</Label><select id="tipo" className="w-full rounded border p-2" value={tipo} onChange={(event) => setTipo(event.target.value)}>{["DIARIO", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].map((value) => <option key={value}>{value}</option>)}</select></div>
					<div><Label htmlFor="inicio">Fecha de inicio</Label><Input id="inicio" type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} /></div>
					<div><Label htmlFor="fin">Fecha de fin</Label><Input id="fin" type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} /></div>
					<div><Label htmlFor="categoria-apertura">Categoría del período</Label><select id="categoria-apertura" className="w-full rounded border p-2" value={categoria} onChange={(event) => setCategoria(event.target.value)}>{["ORDINARIO", "EXTRAORDINARIO", "RECTIFICATIVO"].map((value) => <option key={value}>{value}</option>)}</select></div>
					<div><Label htmlFor="modo-contable">Modo contable</Label><select id="modo-contable" className="w-full rounded border p-2" value={modoContable} onChange={(event) => setModoContable(event.target.value)}>{["CAJA", "DEVENGO"].map((value) => <option key={value}>{value}</option>)}</select></div>
				</div>
				<div className="space-y-2"><Label>Débitos y créditos por cuenta/moneda</Label>
					{lineas.map((line, index) => <div key={index} className="space-y-2 rounded border p-2">
						<div className="grid grid-cols-4 gap-2">
						<Input aria-label={`Cuenta ${index + 1}`} placeholder="Código de cuenta" value={line.cuentaCodigo} onChange={(event) => setLineas((current) => current.map((entry, i) => i === index ? { ...entry, cuentaCodigo: event.target.value } : entry))} />
						<Input aria-label={`Moneda ${index + 1}`} placeholder="Código de moneda" value={line.moneda} onChange={(event) => {
							setLineas((current) => current.map((entry, i) => i === index ? { ...entry, moneda: event.target.value.toUpperCase() } : entry));
						}} />
						<Input aria-label={`Débito ${index + 1}`} placeholder="Débito" inputMode="decimal" value={line.debito} onChange={(event) => {
							setLineas((current) => current.map((entry, i) => i === index ? { ...entry, debito: event.target.value } : entry));
						}} />
						<Input aria-label={`Crédito ${index + 1}`} placeholder="Crédito" inputMode="decimal" value={line.credito} onChange={(event) => {
							setLineas((current) => current.map((entry, i) => i === index ? { ...entry, credito: event.target.value } : entry));
						}} />
						</div>
						{line.moneda && line.moneda !== functionalCurrencyCode && <p className="text-xs text-muted-foreground">La tasa se resolverá en el servidor con el catálogo disponible al enviar la solicitud y con vigencia no posterior a la apertura. Si no hay una tasa elegible, la solicitud no se guardará.</p>}
						{line.moneda === functionalCurrencyCode && <p className="text-xs text-muted-foreground">Importe expresado en moneda funcional; no requiere evidencia FX.</p>}
					</div>)}
					<Button type="button" variant="outline" onClick={() => setLineas((current) => [...current, { cuentaCodigo: "", moneda: functionalCurrencyCode, debito: "0", credito: "0" }])}>Agregar línea</Button>
					<p className="text-sm text-muted-foreground">No se ingresan tasas manualmente ni se generan contrapartidas automáticas.</p>
				</div>
				<div><Label htmlFor="obs">Observaciones</Label><Textarea id="obs" value={observaciones} onChange={(event) => setObservaciones(event.target.value)} /></div>
			</div> : <div className="space-y-3">
				<p>Solicitud {solicitudId}: {estado === "PENDIENTE" ? "pendiente de aprobación" : "aprobada; puede abrirse"}.</p>
				<p>Período: {fechaInicio} a {fechaFin}</p>
				<p className="font-medium">Revise cada cuenta, moneda, débito/crédito y evidencia FX antes de aprobar:</p>
				<div className="space-y-3">{lineasValuadas.map((line, index) => <article key={`${line.cuentaContableId}-${index}`} className="rounded border p-3 text-sm">
					<p className="font-medium">{line.cuentaCodigo} · {line.moneda}: débito {line.debito} / crédito {line.credito}</p>
					<p>Valoración funcional ({line.monedaFuncional}): débito {line.debitoFuncional} / crédito {line.creditoFuncional}</p>
					{line.fxEvidence ? <div className="mt-2 space-y-1 text-muted-foreground">
						<p>Tasa: {line.tasaCambio} · Importe convertido: {line.fxEvidence.functionalAmount} {line.fxEvidence.functionalCurrency}</p>
						<p>Origen: {line.fxEvidence.sourceType}/{line.fxEvidence.sourceId} · Procedencia: {line.fxEvidence.provenance} · Fuente: {line.fxEvidence.source}</p>
						<p>Vigencia: {new Date(line.fxEvidence.rateEffectiveAt).toISOString()} · Corte: {new Date(line.fxEvidence.cutoffAt).toISOString()}</p>
						<p>Catálogo FX: {line.fxEvidence.fxCatalogRateId ?? "No aplica"} · Versión: {line.fxEvidence.evidenceVersion}</p>
						<p className="break-all">Huella de evidencia: {line.fxEvidence.evidenceFingerprint}</p>
					</div> : <p className="text-muted-foreground">Moneda funcional; sin conversión FX.</p>}
				</article>)}</div>
				<p className="break-all text-xs text-muted-foreground">Huella de revisión: {previewHash || "No disponible"}</p>
				<p className="text-sm text-muted-foreground">La aprobación queda registrada con hash; no genera contrapartidas.</p>
			</div>}
			{error && <p className="text-sm text-destructive">{error}</p>}
			<DialogFooter>
				<Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
				{estado === "NUEVA" && <Button type="button" onClick={() => runAction("solicitar")} disabled={loading || !functionalCurrencyCode || !fechaInicio || !fechaFin || lineas.some((line) => !line.moneda)}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para aprobación</Button>}
				{estado === "PENDIENTE" && <Button type="button" onClick={() => runAction("aprobar")} disabled={loading || lineasValuadas.length !== lineas.length}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aprobar cuadre</Button>}
				{estado === "APROBADA" && <Button type="button" onClick={() => runAction("abrir")} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Abrir período aprobado</Button>}
			</DialogFooter>
		</DialogContent>
	</Dialog>;
}
