/**
 * @description Test focal del verificador forense autónomo (D3b).
 *
 * El verificador no confía en los servicios de la aplicación: recalcula los
 * hashes, re-deriva los saldos y cruza el libro con la base operativa. Estos
 * casos comprueban cada tipo de hallazgo y el informe de un libro íntegro.
 */
import { describe, expect, it } from 'vitest';
import { construirHashAsientoV2 } from '@/features/contabilidad-formal/services/posting-engine';
import {
	verificarTenant,
	type AsientoVerificable,
	type EntradaVerificacion,
	type LineaVerificable,
} from '../verificador-forense';

const TENANT = 'tenant-forense';

/**
 * @description Construye una línea de asiento verificable.
 * @param {Partial<LineaVerificable> & { cuentaId: string; debe: string; haber: string }} extra - Línea base.
 * @returns {LineaVerificable} Línea completa.
 */
function linea(extra: Partial<LineaVerificable> & { cuentaId: string; debe: string; haber: string }): LineaVerificable {
	return {
		orden: 1,
		monedaOriginal: 'CUP',
		montoOriginal: extra.debe !== '0' ? extra.debe : extra.haber,
		tasaCambio: '1',
		fxEvidenceFingerprint: 'huella-cup',
		...extra,
	};
}

/**
 * @description Construye un asiento encadenado con el hash canónico v2.
 * @param {object} params - Datos del asiento y su hash anterior.
 * @returns {AsientoVerificable} Asiento con hash recalculado.
 */
function asiento(params: {
	asientoId: string;
	numero: number;
	tenantSequence: bigint;
	hashAnterior: string | null;
	lineas: LineaVerificable[];
	estado?: string;
}): AsientoVerificable {
	const base = {
		tenantId: TENANT,
		diarioId: 'diario-ventas',
		periodoId: 'periodo-1',
		numero: params.numero,
		fecha: new Date('2026-10-02T12:00:00.000Z'),
		estado: params.estado ?? 'CONTABILIZADO',
		origenTipo: 'factura',
		origenId: `factura-${params.numero}`,
		hashAnterior: params.hashAnterior,
	};
	return {
		...base,
		asientoId: params.asientoId,
		hashVersion: 'canonical-v2',
		tenantSequence: params.tenantSequence,
		hash: construirHashAsientoV2({
			...base,
			lineas: params.lineas.map((linea) => ({
				orden: linea.orden,
				cuentaId: linea.cuentaId,
				debe: linea.debe,
				haber: linea.haber,
			})),
			tenantSequence: params.tenantSequence,
		}),
		lineas: params.lineas,
	};
}

/**
 * @description Construye la entrada de verificación con un libro íntegro.
 * @param {AsientoVerificable[]} asientos - Asientos del tenant.
 * @returns {EntradaVerificacion} Entrada lista para verificar.
 */
function entrada(asientos: AsientoVerificable[]): EntradaVerificacion {
	return {
		tenantId: TENANT,
		monedaFuncional: 'CUP',
		asientos,
		cuentaPorRol: { CXC_CLIENTES: 'cta-cxc' },
		saldosOperativos: [{ rol: 'CXC_CLIENTES', saldo: '600', registros: 1 }],
	};
}

describe('verificador forense', () => {
	it('acepta un libro integro y re-deriva los saldos por cuenta', () => {
		const primero = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		});
		const segundo = asiento({
			asientoId: 'ast-2',
			numero: 2,
			tenantSequence: BigInt(2),
			hashAnterior: primero.hash,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '0', haber: '400' }),
				linea({ orden: 2, cuentaId: 'cta-caja', debe: '400', haber: '0' }),
			],
		});

		const informe = verificarTenant(entrada([primero, segundo]));

		expect(informe.hallazgos).toEqual([]);
		expect(informe.resumen.integridadCadena).toBe('VALIDA');
		expect(informe.resumen.asientos).toBe(2);
		expect(informe.resumen.lineas).toBe(4);
		expect(informe.saldosPorCuenta).toEqual([
			{ cuentaId: 'cta-caja', debe: '400', haber: '0', saldo: '400' },
			{ cuentaId: 'cta-cxc', debe: '1000', haber: '400', saldo: '600' },
			{ cuentaId: 'cta-ventas', debe: '0', haber: '1000', saldo: '-1000' },
		]);
		expect(informe.cruces).toEqual([
			{
				rol: 'CXC_CLIENTES',
				cuentaId: 'cta-cxc',
				saldoFormal: '600',
				saldoOperativo: '600',
				diferencia: '0',
				estado: 'COINCIDE',
			},
		]);
		expect(informe.hallazgos).toEqual([]);
	});

	it('detecta el cruce desbalanceado con la base operativa', () => {
		const libro = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		});

		const informe = verificarTenant(entrada([libro]));

		expect(informe.cruces[0].estado).toBe('DIFIERE');
		expect(informe.cruces[0].diferencia).toBe('400');
		expect(informe.resumen.hallazgosPorCausa.CRUCE_OPERATIVO_DESBALANCEADO).toBe(1);
	});

	it('detecta una linea alterada despues de contabilizada', () => {
		const original = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		});
		const alterado: AsientoVerificable = {
			...original,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '9000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		};

		const informe = verificarTenant(entrada([alterado]));

		expect(informe.resumen.integridadCadena).toBe('INVALIDA');
		expect(informe.hallazgos.some((h) => h.causa === 'CADENA_HASH_INVALIDA')).toBe(true);
		expect(informe.hallazgos.some((h) => h.causa === 'ASIENTO_DESCUADRADO')).toBe(true);
	});

	it('detecta un asiento descuadrado y una linea ambigua', () => {
		const descuadrado = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '900' }),
			],
		});
		const ambiguo = asiento({
			asientoId: 'ast-2',
			numero: 2,
			tenantSequence: BigInt(2),
			hashAnterior: descuadrado.hash,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '100', haber: '100' }),
				linea({ orden: 2, cuentaId: 'cta-caja', debe: '200', haber: '0' }),
			],
		});

		const informe = verificarTenant(entrada([descuadrado, ambiguo]));

		const causas = informe.hallazgos.map((h) => h.causa);
		expect(causas).toContain('ASIENTO_DESCUADRADO');
		expect(causas).toContain('LINEA_AMBIGUA');
	});

	it('detecta la evidencia fx ausente en moneda extranjera', () => {
		const extranjero = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({
					orden: 1,
					cuentaId: 'cta-cxc',
					debe: '100',
					haber: '0',
					monedaOriginal: 'USD',
					tasaCambio: null,
					fxEvidenceFingerprint: null,
				}),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '100' }),
			],
		});

		const informe = verificarTenant(entrada([extranjero]));

		const hallazgo = informe.hallazgos.find((h) => h.causa === 'EVIDENCIA_FX_AUSENTE');
		expect(hallazgo).toBeDefined();
		expect(hallazgo?.cuentaId).toBe('cta-cxc');
	});

	it('no cruza un tenant que aun no tiene asientos formales', () => {
		const base: EntradaVerificacion = {
			...entrada([]),
			saldosOperativos: [{ rol: 'CXC_CLIENTES', saldo: '1000', registros: 1 }],
		};

		const informe = verificarTenant(base);

		expect(informe.resumen.integridadCadena).toBe('SIN_ASIENTOS');
		expect(informe.cruces[0].estado).toBe('NO_EVALUABLE');
		expect(informe.hallazgos).toEqual([]);
	});

	it('deja el cruce sin evaluar cuando la base operativa no tiene importe funcional', () => {
		const libro = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		});
		const base: EntradaVerificacion = {
			...entrada([libro]),
			saldosOperativos: [
				{
					rol: 'CXC_CLIENTES',
					saldo: null,
					registros: 1,
					causaNoEvaluable: '1 cuentas por cobrar sin importe funcional',
				},
			],
		};

		const informe = verificarTenant(base);

		expect(informe.cruces[0].estado).toBe('NO_EVALUABLE');
		expect(informe.hallazgos.some((h) => h.causa === 'CRUCE_OPERATIVO_DESBALANCEADO')).toBe(false);
	});

	it('no suma al saldo los asientos anulados', () => {
		const original = asiento({
			asientoId: 'ast-1',
			numero: 1,
			tenantSequence: BigInt(1),
			hashAnterior: null,
			lineas: [
				linea({ orden: 1, cuentaId: 'cta-cxc', debe: '1000', haber: '0' }),
				linea({ orden: 2, cuentaId: 'cta-ventas', debe: '0', haber: '1000' }),
			],
		});
		const anulado: AsientoVerificable = { ...original, estado: 'ANULADO' };

		const informe = verificarTenant(entrada([anulado]));

		expect(informe.saldosPorCuenta).toEqual([]);
	});
});
