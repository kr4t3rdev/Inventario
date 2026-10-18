/**
 * @description Contrato estático del schema: ninguna relación del catálogo
 * puede volver a declarar borrado en cascada destructiva de productos.
 * Bloquea la regresión del hallazgo "cascade gemelo" (borrar un punto de
 * venta o una categoría destruía el catálogo a nivel de base de datos).
 *
 * @module lib/__tests__/catalog-cascade-contract.test
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Extrae el bloque `model <nombre> { ... }` del schema Prisma. */
function extraerModelo(schema: string, nombre: string): string {
	const match = schema.match(new RegExp(`^model ${nombre} \\{([\\s\\S]*?)^\\}`, 'm'));
	if (!match) throw new Error(`Modelo ${nombre} no encontrado en schema.prisma`);
	return match[1];
}

/** Verifica que un campo relacional declara el onDelete esperado. */
function expectOnDelete(modelo: string, campo: string, esperado: string): void {
	const regex = new RegExp(`^\\s*${campo}\\s+\\w+\\??\\s+@relation\\([^;]*?\\)`, 'm');
	const declaracion = modelo.match(regex);
	expect({ campo, encontrado: declaracion?.[0] ?? null }).toBeTruthy();
	const onDelete = declaracion?.[0]?.match(/onDelete:\s*(\w+)/)?.[1];
	expect({
		campo,
		onDelete,
		esperado,
	}).toEqual({ campo, onDelete: esperado, esperado });
}

describe('Contrato de cascadas del catálogo (schema.prisma)', () => {
	const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

	it('Producto.puntoDeVenta desvincula (SetNull) en lugar de destruir productos', () => {
		expectOnDelete(extraerModelo(schema, 'Producto'), 'puntoDeVenta', 'SetNull');
	});

	it('Producto.categoria restringe el borrado (Restrict) en lugar de destruir productos', () => {
		expectOnDelete(extraerModelo(schema, 'Producto'), 'categoria', 'Restrict');
	});

	it('Categoria.parent restringe el borrado en cadena (Restrict)', () => {
		expectOnDelete(extraerModelo(schema, 'Categoria'), 'parent', 'Restrict');
	});
});
