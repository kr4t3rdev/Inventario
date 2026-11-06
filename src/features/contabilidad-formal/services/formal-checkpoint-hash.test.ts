import { describe, expect, it } from 'vitest';

import { calcularLedgerHash, canonicalJson, hashCanonical } from './formal-checkpoint-hash';

describe('canonicalJson', () => {
	it('ordena las claves de manera estable', () => {
		expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
	});

	it('conserva el orden de los arreglos', () => {
		expect(canonicalJson({ cuentas: [{ codigo: '2' }, { codigo: '1' }] })).toBe(
			'{"cuentas":[{"codigo":"2"},{"codigo":"1"}]}',
		);
	});

	it('omite las propiedades indefinidas', () => {
		expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
	});
});

describe('hashCanonical', () => {
	it('produce el mismo hash ante distinto orden de claves', () => {
		expect(hashCanonical({ a: 1, b: 2 })).toBe(hashCanonical({ b: 2, a: 1 }));
	});

	it('produce un hash distinto ante contenidos distintos', () => {
		expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 2 }));
	});
});

describe('calcularLedgerHash', () => {
	const asientos = [
		{ asientoId: 'a-1', hash: 'h1' },
		{ asientoId: 'a-2', hash: 'h2' },
	];

	it('es estable para la misma cadena de asientos', () => {
		expect(calcularLedgerHash(asientos)).toBe(calcularLedgerHash([...asientos]));
	});

	it('cambia si se altera un asiento de la cadena', () => {
		expect(calcularLedgerHash(asientos)).not.toBe(
			calcularLedgerHash([{ asientoId: 'a-1', hash: 'h1' }, { asientoId: 'a-2', hash: 'alterado' }]),
		);
	});

	it('cambia si se agrega un asiento a la cadena', () => {
		expect(calcularLedgerHash(asientos)).not.toBe(
			calcularLedgerHash([...asientos, { asientoId: 'a-3', hash: 'h3' }]),
		);
	});
});
