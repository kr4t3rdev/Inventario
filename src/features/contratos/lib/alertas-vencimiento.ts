/**
 * @description Calculador puro de alertas de vencimiento de contratos (CTF-6):
 *              sin Prisma ni reloj propio — recibe contratos, configuración por
 *              tenant y la fecha de hoy, y devuelve las alertas a crear sin
 *              persistir. Lo consume el script del cron
 *              (scripts/alertas-vencimiento-contratos.ts).
 * @module features/contratos/lib/alertas-vencimiento
 */
import { resolverDiasAviso } from './dias-aviso';

export type TipoAlertaContrato = 'VENCIMIENTO_PROXIMO' | 'CONTRATO_VENCIDO';

export interface ContratoParaAlerta {
  contratoId: string;
  tenantId: string;
  estado: string;
  fechaFin: Date | null;
  diasAvisoVencimiento?: number | null;
}

export interface AlertaVencimientoCalculada {
  contratoId: string;
  tenantId: string;
  tipo: TipoAlertaContrato;
  fechaAlerta: Date;
  mensaje: string;
  accionRequerida: boolean;
}

export interface AlertaExistente {
  contratoId: string;
  tipo: string;
  fechaAlerta: Date;
}

const MS_POR_DIA = 86_400_000;
/** Un contrato vencido deja de generar alertas pasados 30 días del vencimiento. */
const ANTIGUEDAD_MAXIMA_VENCIDO_DIAS = 30;

/**
 * @description Trunca una fecha al inicio de su día UTC (dedupe determinista).
 * @param {Date} fecha - Fecha a truncar.
 * @returns {Date} Misma fecha a las 00:00 UTC.
 */
function truncarAlDiaUTC(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/**
 * @description Calcula las alertas de vencimiento para un conjunto de contratos.
 *              Solo considera contratos ACTIVO con fechaFin: VENCIMIENTO_PROXIMO
 *              cuando faltan entre 0 y N días (N = aviso por contrato, si no del
 *              tenant, si no 30) y CONTRATO_VENCIDO cuando la fecha fin pasó hace
 *              30 días o menos. La fechaAlerta queda truncada al día de hoy.
 * @param {ContratoParaAlerta[]} contratos - Contratos activos a evaluar.
 * @param {Map<string, number>} configsPorTenant - tenantId → diasAvisoVencimiento.
 * @param {Date} hoy - Fecha de referencia de la corrida.
 * @returns {AlertaVencimientoCalculada[]} Alertas a crear, sin persistir.
 */
export function calcularAlertasVencimiento(
  contratos: ContratoParaAlerta[],
  configsPorTenant: Map<string, number>,
  hoy: Date,
): AlertaVencimientoCalculada[] {
  const fechaAlerta = truncarAlDiaUTC(hoy);
  const alertas: AlertaVencimientoCalculada[] = [];

  for (const contrato of contratos) {
    if (contrato.estado !== 'ACTIVO' || !contrato.fechaFin) continue;

    const diasRestantes = Math.ceil((contrato.fechaFin.getTime() - hoy.getTime()) / MS_POR_DIA);
    const configTenant = configsPorTenant.has(contrato.tenantId)
      ? { diasAvisoVencimiento: configsPorTenant.get(contrato.tenantId)! }
      : null;
    const diasAviso = resolverDiasAviso(contrato, configTenant);

    if (diasRestantes >= 0 && diasRestantes <= diasAviso) {
      alertas.push({
        contratoId: contrato.contratoId,
        tenantId: contrato.tenantId,
        tipo: 'VENCIMIENTO_PROXIMO',
        fechaAlerta,
        mensaje: `El contrato vence en ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}.`,
        accionRequerida: diasRestantes <= 7,
      });
    } else if (diasRestantes < 0 && -diasRestantes <= ANTIGUEDAD_MAXIMA_VENCIDO_DIAS) {
      const diasVencido = -diasRestantes;
      alertas.push({
        contratoId: contrato.contratoId,
        tenantId: contrato.tenantId,
        tipo: 'CONTRATO_VENCIDO',
        fechaAlerta,
        mensaje: `El contrato venció hace ${diasVencido} ${diasVencido === 1 ? 'día' : 'días'}.`,
        accionRequerida: true,
      });
    }
  }

  return alertas;
}

/**
 * @description Filtra las alertas candidatas que ya existen para el mismo
 *              contrato, tipo y día de fechaAlerta: correr el cron dos veces el
 *              mismo día no duplica alertas.
 * @param {T[]} candidatas - Alertas calculadas en esta corrida.
 * @param {AlertaExistente[]} existentes - Alertas ya persistidas del conjunto candidato.
 * @returns {T[]} Alertas que sí deben crearse.
 */
export function dedupeAlertasExistentes<T extends AlertaExistente>(
  candidatas: T[],
  existentes: AlertaExistente[],
): T[] {
  const claves = new Set(
    existentes.map((a) => `${a.contratoId}|${a.tipo}|${truncarAlDiaUTC(a.fechaAlerta).toISOString()}`),
  );
  return candidatas.filter(
    (a) => !claves.has(`${a.contratoId}|${a.tipo}|${truncarAlDiaUTC(a.fechaAlerta).toISOString()}`),
  );
}
