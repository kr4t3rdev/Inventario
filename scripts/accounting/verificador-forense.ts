/**
 * @description Verificador forense autónomo de la capa formal (D3b).
 *
 * El módulo es **puro**: no consulta la base ni el estado de runtime. Recibe
 * las filas crudas del libro mayor y los saldos operativos del tenant, y
 * devuelve un informe reproducible con los hallazgos.
 *
 * Qué verifica (sin confiar en los servicios de la aplicación):
 *
 *  1. **Integridad de la cadena de hashes**: recomputa el hash de cada asiento
 *     a partir de sus líneas y valida la topología (una sola raíz, secuencia
 *     contigua, sin duplicados).
 *  2. **Cuadre de cada asiento**: la suma del debe debe igualar la del haber.
 *  3. **Líneas**: un solo lado por línea, importes no negativos y evidencia FX
 *     completa cuando la moneda original no es la funcional.
 *  4. **Saldos por cuenta**: re-deriva el saldo de cada cuenta a partir de las
 *     líneas de los asientos contabilizados (los anulados no suman: su inverso
 *     ya está contabilizado).
 *  5. **Cruce con la base operativa**: compara el saldo formal de las cuentas
 *     por cobrar y por pagar con el saldo operativo del tenant. Cuando la base
 *     operativa no tiene el importe funcional, el cruce queda `NO_EVALUABLE`:
 *     el verificador no estima equivalencias.
 *
 * @module scripts/accounting/verificador-forense
 */
import { Prisma } from '@/generated/prisma';
import {
	construirHashAsiento,
	construirHashAsientoV2,
} from '@/features/contabilidad-formal/services/posting-engine';
import { validateHashChain } from '@/features/contabilidad-formal/services/hash-chain-integrity';

/** Causas de hallazgo forense. */
export type CausaHallazgo =
	| 'CADENA_HASH_INVALIDA'
	| 'ASIENTO_DESCUADRADO'
	| 'ASIENTO_SIN_LINEAS'
	| 'LINEA_AMBIGUA'
	| 'MONTO_NEGATIVO'
	| 'EVIDENCIA_FX_AUSENTE'
	| 'CRUCE_OPERATIVO_DESBALANCEADO';

/** Línea de asiento tal como se lee de la base, en texto decimal exacto. */
export interface LineaVerificable {
	orden: number;
	cuentaId: string;
	debe: string;
	haber: string;
	monedaOriginal: string;
	montoOriginal: string;
	tasaCambio: string | null;
	fxEvidenceFingerprint: string | null;
}

/** Asiento tal como se lee de la base, con sus líneas. */
export interface AsientoVerificable {
	asientoId: string;
	tenantId: string;
	diarioId: string;
	periodoId: string;
	numero: number;
	fecha: Date;
	estado: string;
	origenTipo: string;
	origenId: string;
	hash: string;
	hashAnterior: string | null;
	hashVersion: string | null;
	tenantSequence: bigint | null;
	lineas: LineaVerificable[];
}

/** Saldo operativo del tenant para un rol contable. */
export interface SaldoOperativoVerificable {
	rol: string;
	/** Saldo en moneda funcional; `null` cuando la base operativa no lo tiene. */
	saldo: string | null;
	registros: number;
	/** Motivo por el que el saldo no es evaluable (evidencia funcional ausente). */
	causaNoEvaluable?: string;
}

/** Entrada completa de la verificación de un tenant. */
export interface EntradaVerificacion {
	tenantId: string;
	monedaFuncional: string | null;
	asientos: AsientoVerificable[];
	/** Mapa rol contable → cuenta contable del tenant. */
	cuentaPorRol: Record<string, string>;
	saldosOperativos: SaldoOperativoVerificable[];
}

/** Hallazgo forense acotado y explicable. */
export interface HallazgoForense {
	causa: CausaHallazgo;
	asientoId?: string;
	cuentaId?: string;
	detalle: string;
}

/** Cruce entre el saldo formal y el saldo operativo de un rol. */
export interface CruceOperativo {
	rol: string;
	cuentaId: string | null;
	saldoFormal: string | null;
	saldoOperativo: string | null;
	diferencia: string | null;
	estado: 'COINCIDE' | 'DIFIERE' | 'NO_EVALUABLE';
}

/** Saldo re-derivado de una cuenta. */
export interface SaldoCuenta {
	cuentaId: string;
	debe: string;
	haber: string;
	saldo: string;
}

/** Informe forense de un tenant. */
export interface InformeForense {
	tenantId: string;
	monedaFuncional: string | null;
	resumen: {
		asientos: number;
		lineas: number;
		hallazgos: number;
		hallazgosPorCausa: Record<string, number>;
		integridadCadena: 'VALIDA' | 'INVALIDA' | 'SIN_ASIENTOS';
		saldosPorCuenta: number;
	};
	hallazgos: HallazgoForense[];
	saldosPorCuenta: SaldoCuenta[];
	cruces: CruceOperativo[];
}

/** Tolerancia de comparación de saldos (dos decimales). */
const TOLERANCIA_SALDO = new Prisma.Decimal('0.01');

/**
 * @description Convierte un texto decimal en Decimal exacto.
 * @param {string} valor - Texto decimal persistido.
 * @returns {Prisma.Decimal} Decimal exacto; cero si el texto no es numérico.
 */
function decimal(valor: string | null | undefined): Prisma.Decimal {
	if (valor == null) return new Prisma.Decimal(0);
	try {
		return new Prisma.Decimal(valor);
	} catch {
		return new Prisma.Decimal(0);
	}
}

/**
 * @description Recomputa el hash de un asiento según su versión de hash.
 * @param {AsientoVerificable} asiento - Asiento con sus líneas.
 * @returns {string} Hash recalculado.
 */
function recalcularHash(asiento: AsientoVerificable): string {
	const hashInput = {
		tenantId: asiento.tenantId,
		diarioId: asiento.diarioId,
		periodoId: asiento.periodoId,
		numero: asiento.numero,
		fecha: asiento.fecha,
		origenTipo: asiento.origenTipo,
		origenId: asiento.origenId,
		hashAnterior: asiento.hashAnterior,
		lineas: asiento.lineas.map((linea) => ({
			orden: linea.orden,
			cuentaId: linea.cuentaId,
			debe: asiento.hashVersion === 'legacy-number-v1' ? Number(linea.debe) : String(linea.debe),
			haber: asiento.hashVersion === 'legacy-number-v1' ? Number(linea.haber) : String(linea.haber),
		})),
	};
	return asiento.hashVersion === 'canonical-v2'
		? construirHashAsientoV2({ ...hashInput, tenantSequence: asiento.tenantSequence ?? BigInt(0) })
		: construirHashAsiento(hashInput);
}

/**
 * @description Verifica el tenant y devuelve el informe forense.
 * @param {EntradaVerificacion} entrada - Filas del libro, roles y saldos operativos.
 * @returns {InformeForense} Informe con hallazgos, saldos re-derivenados y cruces.
 */
export function verificarTenant(entrada: EntradaVerificacion): InformeForense {
	const hallazgos: HallazgoForense[] = [];
	const saldos = new Map<string, { debe: Prisma.Decimal; haber: Prisma.Decimal }>();
	const monedaFuncional = entrada.monedaFuncional?.trim().toUpperCase() || null;

	// 1) Cadena de hashes: topología y recálculo de cada hash persistido.
	const validacion = validateHashChain(entrada.asientos, (row) => recalcularHash(row));
	if (!validacion.valid) {
		hallazgos.push({
			causa: 'CADENA_HASH_INVALIDA',
			...(validacion.failureId ? { asientoId: validacion.failureId } : {}),
			detalle: 'La cadena de hashes del tenant no es íntegra o está sin clasificar',
		});
	}

	for (const asiento of entrada.asientos) {
		// 2) Cuadre del asiento.
		if (asiento.lineas.length === 0) {
			hallazgos.push({
				causa: 'ASIENTO_SIN_LINEAS',
				asientoId: asiento.asientoId,
				detalle: 'El asiento no tiene líneas',
			});
			continue;
		}
		let debe = new Prisma.Decimal(0);
		let haber = new Prisma.Decimal(0);
		for (const linea of asiento.lineas) {
			const valorDebe = decimal(linea.debe);
			const valorHaber = decimal(linea.haber);
			debe = debe.add(valorDebe);
			haber = haber.add(valorHaber);

			// 3) Coherencia de la línea.
			if (valorDebe.lt(0) || valorHaber.lt(0)) {
				hallazgos.push({
					causa: 'MONTO_NEGATIVO',
					asientoId: asiento.asientoId,
					cuentaId: linea.cuentaId,
					detalle: `Línea ${linea.orden} con importe negativo`,
				});
			}
			if (valorDebe.gt(0) && valorHaber.gt(0)) {
				hallazgos.push({
					causa: 'LINEA_AMBIGUA',
					asientoId: asiento.asientoId,
					cuentaId: linea.cuentaId,
					detalle: `Línea ${linea.orden} con debe y haber simultáneos`,
				});
			}
			if (
				monedaFuncional &&
				linea.monedaOriginal.trim().toUpperCase() !== monedaFuncional &&
				(linea.tasaCambio == null || linea.fxEvidenceFingerprint == null)
			) {
				hallazgos.push({
					causa: 'EVIDENCIA_FX_AUSENTE',
					asientoId: asiento.asientoId,
					cuentaId: linea.cuentaId,
					detalle: `Línea ${linea.orden} en ${linea.monedaOriginal} sin tasa ni huella FX`,
				});
			}

			// 4) Saldos por cuenta (solo asientos contabilizados).
			if (asiento.estado !== 'CONTABILIZADO') continue;
			const saldo = saldos.get(linea.cuentaId) ?? {
				debe: new Prisma.Decimal(0),
				haber: new Prisma.Decimal(0),
			};
			saldo.debe = saldo.debe.add(valorDebe);
			saldo.haber = saldo.haber.add(valorHaber);
			saldos.set(linea.cuentaId, saldo);
		}
		if (!debe.eq(haber)) {
			hallazgos.push({
				causa: 'ASIENTO_DESCUADRADO',
				asientoId: asiento.asientoId,
				detalle: `Debe ${debe.toString()} contra haber ${haber.toString()}`,
			});
		}
	}

	const saldosPorCuenta: SaldoCuenta[] = [...saldos.entries()]
		.map(([cuentaId, saldo]) => ({
			cuentaId,
			debe: saldo.debe.toString(),
			haber: saldo.haber.toString(),
			saldo: saldo.debe.sub(saldo.haber).toString(),
		}))
		.sort((a, b) => a.cuentaId.localeCompare(b.cuentaId));

	// 5) Cruce con la base operativa.
	const cruces: CruceOperativo[] = [];
	for (const operativo of entrada.saldosOperativos) {
		const cuentaId = entrada.cuentaPorRol[operativo.rol] ?? null;
		const saldoFormal = cuentaId
			? saldosPorCuenta.find((saldo) => saldo.cuentaId === cuentaId)?.saldo ?? '0'
			: null;
		const base: CruceOperativo = {
			rol: operativo.rol,
			cuentaId,
			saldoFormal,
			saldoOperativo: operativo.saldo,
			diferencia: null,
			estado: 'NO_EVALUABLE',
		};
		if (!cuentaId) {
			cruces.push(base);
			continue;
		}
		// Sin asientos formales el tenant no tiene libro contra el que cruzar.
		if (entrada.asientos.length === 0) {
			cruces.push(base);
			continue;
		}
		if (operativo.saldo == null) {
			cruces.push(base);
			continue;
		}
		const diferencia = decimal(saldoFormal).sub(decimal(operativo.saldo));
		base.diferencia = diferencia.toString();
		base.estado = diferencia.abs().lte(TOLERANCIA_SALDO) ? 'COINCIDE' : 'DIFIERE';
		if (base.estado === 'DIFIERE') {
			hallazgos.push({
				causa: 'CRUCE_OPERATIVO_DESBALANCEADO',
				cuentaId,
				detalle: `Rol ${operativo.rol}: saldo formal ${saldoFormal} contra saldo operativo ${operativo.saldo} (diferencia ${diferencia.toString()})`,
			});
		}
		cruces.push(base);
	}

	const hallazgosPorCausa: Record<string, number> = {};
	for (const hallazgo of hallazgos) {
		hallazgosPorCausa[hallazgo.causa] = (hallazgosPorCausa[hallazgo.causa] ?? 0) + 1;
	}

	return {
		tenantId: entrada.tenantId,
		monedaFuncional,
		resumen: {
			asientos: entrada.asientos.length,
			lineas: entrada.asientos.reduce((total, asiento) => total + asiento.lineas.length, 0),
			hallazgos: hallazgos.length,
			hallazgosPorCausa,
			integridadCadena:
				entrada.asientos.length === 0 ? 'SIN_ASIENTOS' : validacion.valid ? 'VALIDA' : 'INVALIDA',
			saldosPorCuenta: saldosPorCuenta.length,
		},
		hallazgos,
		saldosPorCuenta,
		cruces,
	};
}
