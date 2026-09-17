/**
 * @description Contrato de adaptador fiscal del Gap 4: cada jurisdicción (país
 * con timbrado) implementa esta interfaz; el resto del sistema solo conoce este
 * contrato y nunca habla con un PAC directamente.
 */

/** Datos mínimos que el adaptador necesita para generar el documento fiscal. */
export interface FiscalEmisionInput {
	facturaId: string;
	numeroFactura: string;
	tipoDocumento: string;
	total: number;
	subtotal: number;
	descuento: number;
	tenantId: string;
	/** Datos del emisor (tenant) ya cargados por el servicio, si existen. */
	emisor?: {
		taxId?: string | null;
		razonSocial?: string | null;
		regimenFiscal?: string | null;
		codigoPostalFiscal?: string | null;
	};
	/** Datos fiscales del cliente, si aplican. */
	clienteFiscal?: {
		nombre?: string | null;
		taxIdCliente?: string | null;
	} | null;
}

/** Salida de la generación del documento fiscal. */
export interface FiscalEmisionResultado {
	uuidExterno: string;
	xml: string;
	folio: string;
}

export interface FiscalAdapter {
	/** Identificador de la jurisdicción a la que este adaptador responde ("MX-SAT", "LOCAL"...). */
	jurisdiccion: string;
	/**
	 * @description Genera (y en un adaptador real, timbra) el documento fiscal.
	 * En LocalAdapter no hay red: lo genera sintéticamente y lo marca completo.
	 */
	generar(input: FiscalEmisionInput): Promise<FiscalEmisionResultado>;
}
