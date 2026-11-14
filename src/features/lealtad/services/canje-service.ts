/**
 * @description Lógica de canje de puntos de lealtad.
 *
 * Orquesta la verificación y cálculo del canje usando las reglas puras
 * de `puntos-calculo.ts`. No accede a la base de datos.
 *
 * @module features/lealtad/services/canje-service
 */
import { verificarCanje, calcularValorCanje } from './puntos-calculo';

export interface CanjeParams {
  /** Saldo actual de puntos del cliente. */
  saldoActual: number;
  /** Puntos que el cliente quiere canjear. */
  puntosSolicitados: number;
  /** Puntos mínimos requeridos por el programa para un canje. */
  puntosMinimos: number;
  /** Valor monetario (centavos) por bloque de puntos mínimos. */
  valorCanje: number;
}

export interface CanjeResultado {
  /** Si el canje fue aprobado. */
  aprobado: boolean;
  /** Motivo del rechazo (solo si aprobado === false). */
  motivo?: string;
  /** Valor monetario del canje en centavos. */
  valorCanje: number;
  /** Nuevo saldo después del canje. */
  nuevoSaldo: number;
  /** Puntos restantes no canjeables (residuo). */
  puntosRestantes: number;
}

/**
 * @description Procesa un canje de puntos: verifica saldo, calcula el valor
 * monetario y determina el nuevo saldo.
 * @param {CanjeParams} params - Datos del canje.
 * @returns {CanjeResultado} Resultado con estado, valor y nuevo saldo.
 */
export function procesarCanje(params: CanjeParams): CanjeResultado {
  const verificacion = verificarCanje({
    saldoActual: params.saldoActual,
    puntosSolicitados: params.puntosSolicitados,
    puntosMinimos: params.puntosMinimos,
  });

  if (!verificacion.aprobado) {
    return {
      aprobado: false,
      motivo: verificacion.motivo,
      valorCanje: 0,
      nuevoSaldo: params.saldoActual,
      puntosRestantes: 0,
    };
  }

  const valor = calcularValorCanje({
    puntos: params.puntosSolicitados,
    puntosMinimos: params.puntosMinimos,
    valorCanje: params.valorCanje,
  });

  const nuevoSaldo = params.saldoActual - params.puntosSolicitados;
  const puntosRestantes = params.puntosSolicitados % params.puntosMinimos;

  return {
    aprobado: true,
    valorCanje: valor,
    nuevoSaldo,
    puntosRestantes,
  };
}
