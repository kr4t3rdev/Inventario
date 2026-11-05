import type { Prisma } from '@/generated/prisma';

/**
 * @description Proyección del lote y de su documento de origen para la trazabilidad.
 * Las relaciones se resuelven por FK compuesta con `tenantId`, por lo que solo
 * incluyen documentos del mismo tenant que el lote consultado.
 */
export const trazabilidadLoteSelect = {
	id: true,
	codigo: true,
	productoId: true,
	fechaVencimiento: true,
	cantidadInicial: true,
	cantidadDisponible: true,
	producto: { select: { nombre: true } },
	compraItem: {
		select: {
			cantidad: true,
			compraDocumento: {
				select: {
					compraDocumentoId: true,
					numeroFactura: true,
					fechaCompra: true,
					estado: true,
					proveedor: { select: { nombre: true } },
				},
			},
		},
	},
	recepcionItem: {
		select: {
			cantidad: true,
			recepcion: {
				select: {
					id: true,
					fecha: true,
					orden: {
						select: {
							id: true,
							estado: true,
							proveedor: { select: { nombre: true } },
						},
					},
				},
			},
		},
	},
} satisfies Prisma.LoteSelect;

/**
 * @description Registro del lote con su documento de origen, tal como lo devuelve Prisma.
 */
export type RegistroLoteTrazabilidad = Prisma.LoteGetPayload<{
	select: typeof trazabilidadLoteSelect;
}>;

/**
 * @description Documento que originó el lote: factura de compra o recepción de una orden de compra.
 */
export type OrigenTrazabilidadLote = {
	tipo: 'COMPRA' | 'RECEPCION';
	documentoId: string;
	numero: string;
	fecha: Date;
	estado: string;
	proveedor: string;
	cantidad: number;
};

/**
 * @description Construye el documento de origen del lote con precedencia de compra sobre recepción.
 * @param {RegistroLoteTrazabilidad} registro - Lote con sus relaciones de origen cargadas.
 * @returns {OrigenTrazabilidadLote | null} Documento de origen o null si el lote no tiene origen.
 */
export function construirOrigenTrazabilidad(
	registro: RegistroLoteTrazabilidad,
): OrigenTrazabilidadLote | null {
	if (registro.compraItem) {
		const documento = registro.compraItem.compraDocumento;
		return {
			tipo: 'COMPRA',
			documentoId: documento.compraDocumentoId,
			numero: documento.numeroFactura || 'Compra sin factura',
			fecha: documento.fechaCompra,
			estado: documento.estado,
			proveedor: documento.proveedor.nombre,
			cantidad: registro.compraItem.cantidad,
		};
	}
	if (registro.recepcionItem) {
		const recepcion = registro.recepcionItem.recepcion;
		return {
			tipo: 'RECEPCION',
			documentoId: recepcion.id,
			numero: recepcion.orden.id,
			fecha: recepcion.fecha,
			estado: recepcion.orden.estado,
			proveedor: recepcion.orden.proveedor.nombre,
			cantidad: registro.recepcionItem.cantidad,
		};
	}
	return null;
}
