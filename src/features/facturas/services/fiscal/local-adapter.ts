import type {
	FiscalAdapter,
	FiscalEmisionInput,
	FiscalEmisionResultado,
} from './fiscal-adapter';

/**
 * @description Adaptador fiscal "LOCAL" (Gap 4): implementación de referencia
 * sin red. Genera un XML sintético con los datos mínimos y simula el timbrado
 * con un UUID propio. Sirve como verificación de la cadena completa (emisión →
 * documento → eventos) sin llamadas externas y como plantilla que un PAC real
 * (CFDI/SAT, DGII, DIAN…) reemplaza implementando la misma interfaz.
 */
export const LocalAdapter: FiscalAdapter = {
	jurisdiccion: 'LOCAL',

	/**
	 * @description Genera el comprobante y lo "timbra" localmente.
	 * @param {FiscalEmisionInput} input - Datos mínimos del comprobante.
	 * @returns {Promise<FiscalEmisionResultado>} UUID ficticio, XML y folio.
	 */
	async generar(input: FiscalEmisionInput): Promise<FiscalEmisionResultado> {
		const uuidExterno = `LOCAL-${input.facturaId}-${Date.now()}`;
		const xml =
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<ComprobanteLocal ` +
			`version="1.0" numeroFactura="${input.numeroFactura}" ` +
			`tipoDocumento="${input.tipoDocumento}" total="${input.total}">\n` +
			`  <Emisor taxId="${input.emisor?.taxId ?? ''}" razonSocial="${input.emisor?.razonSocial ?? ''}"/>\n` +
			`  <Receptor taxId="${input.clienteFiscal?.taxIdCliente ?? ''}"/>\n` +
			`</ComprobanteLocal>`;
		const folio = input.numeroFactura;
		return { uuidExterno, xml, folio };
	},
};
