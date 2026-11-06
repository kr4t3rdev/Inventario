export interface ReglaPutawayCandidata {
	id: string;
	tenantId: string;
	productoId: string | null;
	categoriaId: string | null;
	ubicacionId: string;
}

export interface PutawayResolution {
	reglaId: string;
	ubicacionId: string;
	alcance: 'PRODUCTO' | 'CATEGORIA';
}

/**
 * @description Resuelve la regla por producto antes que por categoría, aislada por tenant.
 * @param {{ tenantId: string; productoId: string; categoriaId: string }} input - Entidades destino.
 * @param {readonly ReglaPutawayCandidata[]} reglas - Reglas candidatas.
 * @returns {PutawayResolution | null} Sugerencia resuelta o ausencia explícita.
 */
export function resolverReglaPutaway(
	input: { tenantId: string; productoId: string; categoriaId: string },
	reglas: readonly ReglaPutawayCandidata[],
): PutawayResolution | null {
	const propias = reglas.filter((regla) => regla.tenantId === input.tenantId);
	const producto = propias.find((regla) => regla.productoId === input.productoId);
	if (producto) {
		return { reglaId: producto.id, ubicacionId: producto.ubicacionId, alcance: 'PRODUCTO' };
	}
	const categoria = propias.find((regla) => regla.categoriaId === input.categoriaId);
	return categoria
		? { reglaId: categoria.id, ubicacionId: categoria.ubicacionId, alcance: 'CATEGORIA' }
		: null;
}
