import { afterAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';

assertDisposableDatabase(process.env);

const EXPECTED_PRECISIONS = {
	'CompraDocumento.montoConvertido': 'numeric(20,4)',
	'CompraDocumento.tasaCambio': 'numeric(20,10)',
	'InyeccionCapital.montoConvertido': 'numeric(20,4)',
	'InyeccionCapital.tasaCambio': 'numeric(20,10)',
	'PagoDeuda.montoConvertido': 'numeric(20,4)',
	'PagoDeuda.tasaCambio': 'numeric(20,10)',
	'TransferenciaBancaria.montoConvertido': 'numeric(20,4)',
} as const;

/** @description Verifica la precisión física de los siete campos FX en PostgreSQL. */
describe('precisión física de campos FX — PostgreSQL aislado', () => {
	afterAll(async () => {
		await prisma.$disconnect();
	});

	it('usa las precisiones declaradas por las migraciones FX', async () => {
		const target = new URL(process.env.DATABASE_URL ?? '');
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		expect(identity[0]).toEqual({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});

		const columns = await prisma.$queryRaw<Array<{
			table_name: string;
			column_name: string;
			sql_type: string;
		}>>`
			SELECT c.table_name, c.column_name,
				format_type(a.atttypid, a.atttypmod) AS sql_type
			FROM information_schema.columns c
			JOIN pg_catalog.pg_class t ON t.relname = c.table_name
			JOIN pg_catalog.pg_namespace n
				ON n.oid = t.relnamespace AND n.nspname = c.table_schema
			JOIN pg_catalog.pg_attribute a
				ON a.attrelid = t.oid AND a.attname = c.column_name AND NOT a.attisdropped
			WHERE c.table_schema = 'public'
				AND (c.table_name, c.column_name) IN (
					('CompraDocumento', 'montoConvertido'),
					('CompraDocumento', 'tasaCambio'),
					('InyeccionCapital', 'montoConvertido'),
					('InyeccionCapital', 'tasaCambio'),
					('PagoDeuda', 'montoConvertido'),
					('PagoDeuda', 'tasaCambio'),
					('TransferenciaBancaria', 'montoConvertido')
				)
			ORDER BY c.table_name, c.column_name
		`;

		const actual = Object.fromEntries(
			columns.map(({ table_name, column_name, sql_type }) => [
				`${table_name}.${column_name}`,
				sql_type,
			]),
		);
		expect(actual).toEqual(EXPECTED_PRECISIONS);
	});
});
