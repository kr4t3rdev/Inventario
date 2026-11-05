import { describe, expect, it } from 'vitest';
import { resolverReglaPutaway, type ReglaPutawayCandidata } from '../putaway';

/**
 * @description Crea una regla mínima para pruebas de precedencia y tenant.
 * @param {string} id - Identificador de la regla.
 * @param {string} tenantId - Tenant dueño de la regla.
 * @param {string | null} productoId - Producto asociado.
 * @param {string | null} categoriaId - Categoría asociada.
 * @returns {ReglaPutawayCandidata} Regla de prueba.
 */
const rule = (
	id: string,
	tenantId: string,
	productoId: string | null,
	categoriaId: string | null,
): ReglaPutawayCandidata => ({
	id,
	tenantId,
	productoId,
	categoriaId,
	ubicacionId: `loc-${id}`,
});
const input = { tenantId: 't1', productoId: 'p1', categoriaId: 'c1' };

describe('resolverReglaPutaway', () => {
	it('prioriza producto sobre categoría', () => {
		const result = resolverReglaPutaway(input, [
			rule('c', 't1', null, 'c1'), rule('p', 't1', 'p1', null),
		]);

		expect(result).toEqual({ reglaId: 'p', ubicacionId: 'loc-p', alcance: 'PRODUCTO' });
	});
	it('usa categoría si no existe regla de producto', () => {
		const result = resolverReglaPutaway(input, [rule('c', 't1', null, 'c1')]);

		expect(result?.alcance).toBe('CATEGORIA');
	});
	it('ignora reglas de otro tenant y usa null como fallback', () => {
		expect(resolverReglaPutaway(input, [rule('p', 't2', 'p1', null)])).toBeNull();
	});
});
