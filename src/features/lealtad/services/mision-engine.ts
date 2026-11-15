/**
 * @description Motor de evaluación de progreso de misiones de gamificación.
 *
 * Evalúa si una compra avanza el progreso de una misión y determina
 * si se completó, otorgando los puntos correspondientes.
 *
 * @module features/lealtad/services/mision-engine
 */

export interface MisionInfo {
  tipo: 'COMPRA_CATEGORIA' | 'FRECUENCIA' | 'AOV' | 'PRIMERA_COMPRA';
  reglas: Record<string, unknown>;
  recompensaPuntos: number;
}

export interface CompraInfo {
  categoriaId?: string;
  total?: number;
  esPrimeraCompra?: boolean;
}

export interface EvaluarProgresoParams {
  mision: MisionInfo;
  progresoActual: number;
  compra: CompraInfo;
}

export interface ProgresoResultado {
  nuevoProgreso: number;
  completado: boolean;
  puntosGanados: number;
}

/**
 * @description Evalúa si una compra avanza el progreso de una misión.
 * @param {EvaluarProgresoParams} params - Datos de la misión, progreso y compra.
 * @returns {ProgresoResultado} Nuevo progreso, estado y puntos ganados.
 */
export function evaluarProgresoMision(params: EvaluarProgresoParams): ProgresoResultado {
  let avance = 0;

  switch (params.mision.tipo) {
    case 'COMPRA_CATEGORIA': {
      const catId = params.mision.reglas.categoriaId as string | undefined;
      if (catId && params.compra.categoriaId === catId) {
        avance = 1;
      }
      break;
    }
    case 'FRECUENCIA': {
      avance = 1;
      break;
    }
    case 'AOV': {
      const umbral = params.mision.reglas.umbral as number | undefined;
      if (umbral && params.compra.total && params.compra.total >= umbral) {
        avance = 1;
      }
      break;
    }
    case 'PRIMERA_COMPRA': {
      if (params.compra.esPrimeraCompra) {
        avance = 1;
      }
      break;
    }
  }

  const cantidadRequerida = (params.mision.reglas.cantidad as number) || 1;
  const nuevoProgreso = Math.min(params.progresoActual + avance, cantidadRequerida);
  const completado = nuevoProgreso >= cantidadRequerida && params.progresoActual < cantidadRequerida;

  return {
    nuevoProgreso,
    completado,
    puntosGanados: completado ? params.mision.recompensaPuntos : 0,
  };
}
