import type { FormalFinancialReportResolution } from './formal-financial-report-contract';

/**
 * @description Escapa un campo para CSV: entrecomilla si contiene separadores
 * o saltos de línea y duplica las comillas internas.
 * @param {string} valor - Campo a escapar.
 * @returns {string} Campo listo para CSV.
 */
function escaparCampo(valor: string): string {
	return /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * @description Serializa el reporte contable formal en CSV.
 *
 * El archivo describe dos secciones: el balance acumulado por cuenta y el
 * resultado del período por tipo contable. Los importes se emiten con su
 * precisión decimal exacta, sin conversión a coma flotante.
 *
 * @param {Extract<FormalFinancialReportResolution, { status: 'AVAILABLE' }>} reporte - Reporte disponible.
 * @returns {string} Contenido CSV del reporte formal.
 */
export function formalReportToCsv(
	reporte: Extract<FormalFinancialReportResolution, { status: 'AVAILABLE' }>,
): string {
	const filas: string[] = ['seccion,tipo,codigo,cuenta,importe'];

	for (const cuenta of reporte.accounts) {
		filas.push([
			'BALANCE',
			cuenta.type,
			cuenta.code,
			cuenta.name,
			cuenta.balance,
		].map(escaparCampo).join(','));
	}

	const resultado = [
		['INGRESOS', reporte.result.income],
		['COSTOS', reporte.result.costs],
		['GASTOS', reporte.result.expenses],
		['RESULTADO_NETO', reporte.result.net],
	] as const;
	for (const [tipo, importe] of resultado) {
		filas.push(['RESULTADO', tipo, '', '', importe].map(escaparCampo).join(','));
	}

	return `${filas.join('\n')}\n`;
}
