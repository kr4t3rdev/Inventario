/**
 * @description Forecast inicial: tasa diaria = salidas de ventas en kardex / días de ventana;
 * el stock disponible suma `cantidadDisponible` (neto de reservas) de ubicaciones del tenant.
 * Quiebre = disponibilidad / tasa. Ventana UTC de 7 a 180 días; se exigen 3 días
 * distintos con salidas. Sin demanda o datos insuficientes no se ofrece fecha estimada.
 */
export const VENTANA_DIAS_MINIMOS = 7;
export const VENTANA_DIAS_MAXIMOS = 180;
export const DIAS_ACTIVOS_MINIMOS = 3;

export type VentanaForecast = { dias: number; inicio: Date; fin: Date; corte: Date };
export type SalidaKardex = { productoId: string; dia: string; unidades: number };
export interface ForecastProducto {
  productoId: string; productoNombre: string; disponibilidad: number; consumoTotal: number;
  diasActivos: number; tasaDiaria: number; diasHastaQuiebre: number | null;
  fechaQuiebre: string | null; estado: 'estimado' | 'sin_demanda' | 'datos_insuficientes';
}

/**
 * @description Resuelve los N días inclusivos hasta la fecha de corte en UTC.
 * @param {Date} fechaCorte - Último día incluido. @param {number} dias - Días de ventana.
 * @returns {VentanaForecast} Ventana semiabierta y fecha de corte normalizadas.
 */
export function resolverVentanaForecast(fechaCorte: Date, dias: number): VentanaForecast {
  const corte = new Date(`${fechaCorte.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const fin = new Date(corte);
  fin.setUTCDate(fin.getUTCDate() + 1);
  const inicio = new Date(corte);
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));
  return { dias, inicio, fin, corte };
}

/**
 * @description Calcula días y fecha hasta quiebre; umbral mínimo: tres días activos.
 * @param {Map<string, number>} disponibles - Stock actual neto de reservas por producto.
 * @param {SalidaKardex[]} salidas - Salidas agrupadas por producto y día.
 * @param {Map<string, string>} nombres - Nombres de producto por ID.
 * @param {VentanaForecast} ventana - Ventana histórica aplicada.
 * @returns Forecast por producto y supuestos del cálculo.
 */
export function calcularForecastQuiebre(
  disponibles: Map<string, number>, salidas: SalidaKardex[], nombres: Map<string, string>, ventana: VentanaForecast,
) {
  const consumo = new Map<string, { unidades: number; dias: Set<string> }>();
  for (const salida of salidas) {
    const item = consumo.get(salida.productoId) ?? { unidades: 0, dias: new Set<string>() };
    item.unidades += salida.unidades;
    item.dias.add(salida.dia);
    consumo.set(salida.productoId, item);
  }
  const ids = new Set([...disponibles.keys(), ...consumo.keys()]);
  const porProducto: ForecastProducto[] = [];
  for (const productoId of ids) {
    const disponible = disponibles.get(productoId) ?? 0;
    const historico = consumo.get(productoId);
    const consumoTotal = historico?.unidades ?? 0;
    const diasActivos = historico?.dias.size ?? 0;
    if (disponible <= 0 && consumoTotal === 0) continue;
    const tasaDiaria = consumoTotal / ventana.dias;
    const estado = consumoTotal === 0 ? 'sin_demanda' : diasActivos < DIAS_ACTIVOS_MINIMOS ? 'datos_insuficientes' : 'estimado';
    const diasHastaQuiebre = estado === 'estimado' ? Math.floor(disponible / tasaDiaria) : null;
    const fecha = diasHastaQuiebre === null ? null : new Date(ventana.corte);
    if (fecha && diasHastaQuiebre !== null) fecha.setUTCDate(fecha.getUTCDate() + diasHastaQuiebre);
    porProducto.push({
      productoId, productoNombre: nombres.get(productoId) ?? 'Sin nombre', disponibilidad: disponible,
      consumoTotal, diasActivos, tasaDiaria, diasHastaQuiebre, fechaQuiebre: fecha?.toISOString() ?? null, estado,
    });
  }
  porProducto.sort((a, b) => (a.diasHastaQuiebre ?? Infinity) - (b.diasHastaQuiebre ?? Infinity));
  return {
    fechaCorte: ventana.corte.toISOString(),
    ventana: { dias: ventana.dias, inicio: ventana.inicio.toISOString(), fin: ventana.fin.toISOString(), minDias: VENTANA_DIAS_MINIMOS, maxDias: VENTANA_DIAS_MAXIMOS },
    supuestos: 'Tasa diaria = salidas de ventas / días de ventana; disponibilidad = stock menos reservas en todas las ubicaciones. Ventana: 7–180 días. Se requieren 3 días activos; demanda cero o datos insuficientes no permiten estimar confiablemente.',
    porProducto,
  };
}
