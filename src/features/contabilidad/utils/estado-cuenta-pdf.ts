/**
 * @description Genera el PDF del estado de cuenta de un cliente (F-6).
 *
 * Composición client-side con jsPDF + autotable (patrón
 * `src/lib/export-utils.ts` / facturas-vencidas): los montos llegan ya
 * calculados por `getEstadoDeCuentaClienteAction`; aquí solo se componen
 * encabezado empresa/cliente, resumen, CxC, anticipos/NC, historial y firma.
 *
 * @module features/contabilidad/utils/estado-cuenta-pdf
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { EstadoDeCuentaClienteData } from "../actions-cuentas";

const formatMoney = (n: number, currency = "DOP") => {
	try {
		return new Intl.NumberFormat("es-DO", {
			style: "currency",
			currency,
		}).format(n);
	} catch {
		return `${currency} ${n.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
	}
};

const formatFecha = (iso: string | null | undefined) => {
	if (!iso) return "-";
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "-" : format(d, "dd/MM/yyyy");
};

const HEAD_STYLES = { fillColor: [66, 66, 66] as [number, number, number] };
const BODY_STYLES = { fontSize: 8, cellPadding: 2 };
const MARGIN = { left: 14, right: 14 };

/** Fila de tabla PDF: celdas escalares aceptadas por jspdf-autotable. */
type FilaPdf = (string | number | null)[];

/**
 * @description Genera y descarga el PDF del estado de cuenta.
 * @param {EstadoDeCuentaClienteData} data - Dataset compuesto por el action.
 * @returns {void}
 */
export function exportEstadoDeCuentaPdf(data: EstadoDeCuentaClienteData): void {
	const doc = new jsPDF();

	// ── Encabezado: empresa + cliente ─────────────────────────────
	let y = 18;
	doc.setFontSize(16);
	doc.text(data.empresa?.nombre ?? "Mi Empresa", 14, y);
	y += 6;
	doc.setFontSize(8);
	const contactoEmpresa = [
		data.empresa?.propietario,
		data.empresa?.direccion,
		data.empresa?.telefono,
		data.empresa?.email,
	]
		.filter(Boolean)
		.join(" · ");
	if (contactoEmpresa) {
		doc.text(contactoEmpresa, 14, y);
		y += 5;
	}

	doc.setFontSize(13);
	doc.text("Estado de Cuenta de Cliente", 14, y + 2);
	y += 8;
	doc.setFontSize(9);
	doc.text(`Cliente: ${data.cliente.nombre} (${data.cliente.clienteId})`, 14, y);
	y += 5;
	const contactoCliente = [data.cliente.telefono, data.cliente.direccion]
		.filter(Boolean)
		.join(" · ");
	if (contactoCliente) {
		doc.text(contactoCliente, 14, y);
		y += 5;
	}
	doc.text(
		`Generado: ${format(new Date(data.generadoEn), "dd/MM/yyyy HH:mm")}`,
		14,
		y,
	);
	y += 8;

	// ── Resumen ────────────────────────────────────────────────────
	const r = data.resumen;
	autoTable(doc, {
		head: [["Concepto", "Valor"]],
		body: r.porMoneda.flatMap((resumen) => [
			[`Deuda total (${resumen.moneda})`, formatMoney(resumen.deudaTotal, resumen.moneda)],
			[`Deuda vencida (${resumen.moneda})`, formatMoney(resumen.deudaVencida, resumen.moneda)],
			[`Saldo a favor (anticipos, ${resumen.moneda})`, formatMoney(resumen.saldoAFavorAnticipos, resumen.moneda)],
			[`Saldo a favor (notas de crédito, ${resumen.moneda})`, formatMoney(resumen.saldoAFavorNotasCredito, resumen.moneda)],
			[`Saldo a favor total (${resumen.moneda})`, formatMoney(resumen.saldoAFavor, resumen.moneda)],
			[`Saldo neto a pagar (${resumen.moneda})`, formatMoney(resumen.saldoNeto, resumen.moneda)],
		]),
		startY: y,
		styles: BODY_STYLES,
		headStyles: HEAD_STYLES,
		margin: MARGIN,
		didParseCell: (cell) => {
			if (cell.row.index % 6 === 5) {
				cell.cell.styles.fontStyle = "bold";
			}
		},
	});
	y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

	const addSection = (
		title: string,
		head: string[],
		body: FilaPdf[],
	): void => {
		if (body.length === 0) return;
		doc.setFontSize(11);
		doc.setFont("helvetica", "bold");
		doc.text(title, 14, y);
		y += 4;
		autoTable(doc, {
			head: [head],
			body,
			startY: y,
			styles: BODY_STYLES,
			headStyles: HEAD_STYLES,
			margin: MARGIN,
		});
		y =
			(doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
				.finalY + 10;
	};

	// ── Cuentas por cobrar ─────────────────────────────────────────
	addSection(
		"Cuentas por Cobrar",
		["Factura", "Emisión", "Vencimiento", "Estado", "Total", "Pagado", "Saldo"],
		data.cuentasPorCobrar.map((c) => [
			c.numeroFactura ?? "S/N",
			formatFecha(c.createdAt?.toISOString?.() ?? null),
			formatFecha(c.fechaVencimiento),
			c.estado,
			formatMoney(c.totalFactura, c.moneda),
			formatMoney(c.totalPagadoFactura, c.moneda),
			formatMoney(c.saldoFactura, c.moneda),
		]),
	);

	// ── Anticipos + notas de crédito ───────────────────────────────
	const saldoAFavorRows: FilaPdf[] = [
		...data.anticipos.map((a) => [
			"Anticipo",
			a.anticipoId,
			formatFecha(a.fechaReserva),
			a.estado,
			formatMoney(a.saldoDisponible, a.moneda),
			a.moneda,
		]),
		...data.notasCredito.map((nc) => [
			"Nota de crédito",
			nc.devolucionId,
			formatFecha(nc.createdAt),
			nc.estado,
			formatMoney(nc.montoSaldoFavor, nc.moneda),
			nc.moneda,
		]),
	];
	addSection(
		"Anticipos y Notas de Crédito (saldo a favor)",
		["Tipo", "Referencia", "Fecha", "Estado", "Saldo a favor", "Moneda"],
		saldoAFavorRows,
	);

	// ── Historial de facturas ──────────────────────────────────────
	addSection(
		"Historial de Facturas",
		["Número", "Fecha", "Vencimiento", "Estado", "Subtotal", "Impuestos", "Total"],
		data.facturas.map((f) => [
			f.numeroFactura,
			formatFecha(f.fechaEmision),
			formatFecha(f.fechaVencimiento),
			f.estado,
			formatMoney(f.subtotal),
			formatMoney(f.impuestos),
			formatMoney(f.total),
		]),
	);

	// ── Historial de pagos ──────────────────────────────────────────
	addSection(
		"Historial de Pagos",
		["Fecha", "Método", "Monto", "Moneda", "Observaciones"],
		data.pagos.map((p) => [
			formatFecha(p.fechaReconciliacion),
			p.tipoPagoNombre ?? "-",
			formatMoney(p.monto, p.moneda),
			p.moneda,
			p.observaciones ?? "-",
		]),
	);

	// ── Saldo neto + línea de firma ────────────────────────────────
	doc.setFontSize(11);
	doc.setFont("helvetica", "bold");
	for (const resumen of r.porMoneda) {
		doc.text(
			`Saldo neto a pagar (${resumen.moneda}): ${formatMoney(resumen.saldoNeto, resumen.moneda)}`,
			14,
			y,
		);
		y += 7;
	}
	y += 23;
	doc.setLineWidth(0.4);
	doc.line(14, y, 94, y);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(8);
	doc.text("Firma y aclaración", 14, y + 4);

	const fecha = format(new Date(), "yyyy-MM-dd");
	doc.save(`estado_cuenta_${data.cliente.clienteId}_${fecha}.pdf`);
}
