/**
 * @description Contratos del plan de cuentas por defecto y sus semillas (CTA-0 T1).
 * Datos puros: jerarquía válida, naturaleza coherente con el tipo, roles
 * semánticos completos y plantillas consistentes. El seed los persiste tal cual.
 */
import { describe, expect, it } from 'vitest';

import {
	CUENTAS_PLAN_DEFAULT,
	DIARIOS_DEFAULT,
	DIARIO_POR_EVENTO,
	PLANTILLAS_DEFAULT,
	ROLES_CUENTA_DEFAULT,
	naturalezaParaTipo,
	padreDeCodigo,
	type TipoEventoClave,
} from '@/features/contabilidad-formal/lib/plan-default';

describe('plan de cuentas por defecto', () => {
	it('los códigos son únicos', () => {
		const codigos = CUENTAS_PLAN_DEFAULT.map((c) => c.codigo);
		expect(new Set(codigos).size).toBe(codigos.length);
	});

	it('la jerarquía es válida: todo hijo tiene padre existente y nivel correcto', () => {
		const porCodigo = new Map(CUENTAS_PLAN_DEFAULT.map((c) => [c.codigo, c]));
		for (const cuenta of CUENTAS_PLAN_DEFAULT) {
			const segmentos = cuenta.codigo.split('.').length;
			expect(cuenta.nivel, `nivel de ${cuenta.codigo}`).toBe(segmentos);
			const padre = padreDeCodigo(cuenta.codigo);
			if (segmentos === 1) {
				expect(padre, `${cuenta.codigo} no debe tener padre`).toBeNull();
			} else {
				expect(padre, `${cuenta.codigo} debe tener padre`).not.toBeNull();
				const padreCuenta = porCodigo.get(padre!);
				expect(padreCuenta, `padre de ${cuenta.codigo} debe existir`).toBeDefined();
				expect(padreCuenta!.nivel).toBe(segmentos - 1);
				expect(
					padreCuenta!.aceptaMovimiento,
					`padre ${padre} no debe aceptar movimiento (es cabecera)`,
				).toBe(false);
			}
		}
	});

	it('la naturaleza es coherente con el tipo de cuenta', () => {
		for (const cuenta of CUENTAS_PLAN_DEFAULT) {
			expect(naturalezaParaTipo(cuenta.tipo), `naturaleza de ${cuenta.codigo}`).toBe(
				cuenta.naturaleza,
			);
		}
	});

	it('los 23 roles semánticos están mapeados a cuentas hoja del plan', () => {
		const porCodigo = new Map(CUENTAS_PLAN_DEFAULT.map((c) => [c.codigo, c]));
		const roles = Object.keys(ROLES_CUENTA_DEFAULT);
		expect(roles).toHaveLength(23);
		for (const [rol, codigo] of Object.entries(ROLES_CUENTA_DEFAULT)) {
			const cuenta = porCodigo.get(codigo);
			expect(cuenta, `rol ${rol} apunta a cuenta inexistente ${codigo}`).toBeDefined();
			expect(
				cuenta!.aceptaMovimiento,
				`rol ${rol} debe apuntar a una cuenta con movimiento`,
			).toBe(true);
		}
	});

	it('los diarios son 7, con códigos y tipos únicos', () => {
		expect(DIARIOS_DEFAULT).toHaveLength(7);
		expect(new Set(DIARIOS_DEFAULT.map((d) => d.codigo)).size).toBe(7);
		expect(new Set(DIARIOS_DEFAULT.map((d) => d.tipo)).size).toBe(7);
	});
});

describe('plantillas de asiento por defecto', () => {
	it('toda línea referencia un rol existente y un lado válido', () => {
		const roles = new Set(Object.keys(ROLES_CUENTA_DEFAULT));
		for (const linea of PLANTILLAS_DEFAULT) {
			expect(roles.has(linea.rolCuenta), `rol ${linea.rolCuenta}`).toBe(true);
			expect(['DEBE', 'HABER']).toContain(linea.lado);
		}
	});

	it('no hay (evento, orden) duplicados', () => {
		const claves = PLANTILLAS_DEFAULT.map((l) => `${l.evento}:${l.orden}`);
		expect(new Set(claves).size).toBe(claves.length);
	});

	it('cada línea tiene al menos un montoRegla válido', () => {
		const reglas = new Set([
			'TOTAL',
			'MONTO_PAGADO',
			'COSTO_FIFO',
			'INTERESES',
			'TOTAL_MENOS_INTERESES',
			'DIFERENCIA_FX',
			'TOTAL_MENOS_DIFERENCIA',
			'TOTAL_MAS_DIFERENCIA',
		]);
		for (const linea of PLANTILLAS_DEFAULT) {
			expect(reglas.has(linea.montoRegla), `regla de ${linea.evento}:${linea.orden}`).toBe(true);
		}
	});

	it('las condiciones usan solo valores conocidos', () => {
		const condiciones = new Set(['FX_POSITIVA', 'FX_NEGATIVA', 'SIN_DIFERENCIA_FX']);
		for (const linea of PLANTILLAS_DEFAULT) {
			if (linea.condicion == null) continue;
			expect(
				condiciones.has(linea.condicion),
				`condición desconocida en ${linea.evento}:${linea.orden}`,
			).toBe(true);
		}
	});

	it('todo evento con plantilla tiene diario asignado y los 33 tipos de evento están cubiertos', () => {
		const tiposDiario = new Set(DIARIOS_DEFAULT.map((d) => d.tipo));
		const eventos: TipoEventoClave[] = [
			'VENTA_CONTADO', 'VENTA_CREDITO', 'COBRO_CXC', 'COSTO_VENTA_DEVENGADO',
			'DEVOLUCION_VENTA', 'VENTA_SERVICIO', 'COBRO_SERVICIO', 'COMPRA_CONTADO',
			'COMPRA_CREDITO', 'PAGO_CXP', 'GASTO_CONTADO', 'GASTO_CREDITO',
			'PAGO_GASTO_CREDITO', 'PAGO_NOMINA', 'ANTICIPO_CLIENTE_RECIBIDO',
			'ANTICIPO_CLIENTE_APLICADO', 'ANTICIPO_PROVEEDOR_ENTREGADO',
			'ANTICIPO_PROVEEDOR_APLICADO', 'PRESTAMO_OTORGADO', 'COBRO_PRESTAMO',
			'DEUDA_RECIBIDA', 'PAGO_DEUDA', 'AJUSTE_BANCARIO_CARGO', 'AJUSTE_BANCARIO_ABONO',
			'TRANSFERENCIA_BANCARIA', 'INYECCION_CAPITAL', 'PAGO_DEUDA_CAPITAL',
			'MERMA_INVENTARIO', 'PRODUCCION_SALIDA', 'GASTO_CON_ANTICIPO_PROVEEDOR',
			'DIFERENCIA_CAMBIARIA', 'APERTURA_PERIODO', 'CIERRE_PERIODO',
		];
		expect(eventos).toHaveLength(33);
		for (const evento of eventos) {
			const diario = DIARIO_POR_EVENTO[evento];
			expect(diario, `evento ${evento} sin diario`).toBeDefined();
			expect(tiposDiario.has(diario), `diario inválido para ${evento}`).toBe(true);
		}
		// Eventos con plantilla no pueden caer en diarios de apertura/cierre
		for (const linea of PLANTILLAS_DEFAULT) {
			expect(DIARIO_POR_EVENTO[linea.evento]).not.toBe('APERTURA_CIERRE');
		}
	});
});
