/**
 * @description Market Basket Analysis usando algoritmo Apriori simplificado.
 *
 * Identifica productos que se compran juntos para sugerir cross-sell
 * y up-sell automático.
 *
 * @module features/cliente-analytics/services/basket-analyzer
 */

export interface BasketItem {
  productoId: string;
  ventaId: string;
}

export interface BasketPair {
  productoA: string;
  productoB: string;
  coocurrencias: number;
  soporte: number; // support: P(A ∪ B)
  confianza: number; // confidence: P(B|A)
  levantamiento: number; // lift: P(B|A) / P(B)
}

export interface BasketAnalysisResult {
  pares: BasketPair[];
  totalTransacciones: number;
  totalProductosUnicos: number;
}

/**
 * @description Ejecuta el análisis de cesta de compras sobre un conjunto de transacciones.
 * @param {BasketItem[]} items - Todos los items de todas las ventas.
 * @param {number} minSoporte - Soporte mínimo (0.01 = 1%).
 * @param {number} minConfianza - Confianza mínima (0.1 = 10%).
 * @returns {BasketAnalysisResult} Pares de productos con métricas.
 */
export function analizarCesta(
  items: BasketItem[],
  minSoporte: number = 0.01,
  minConfianza: number = 0.1
): BasketAnalysisResult {
  // Agrupar items por venta
  const transacciones = new Map<string, Set<string>>();
  for (const item of items) {
    if (!transacciones.has(item.ventaId)) {
      transacciones.set(item.ventaId, new Set());
    }
    transacciones.get(item.ventaId)!.add(item.productoId);
  }

  const totalTransacciones = transacciones.size;
  if (totalTransacciones === 0) {
    return { pares: [], totalTransacciones: 0, totalProductosUnicos: 0 };
  }

  // Contar frecuencia de cada producto
  const productoFrecuencia = new Map<string, number>();
  const productoSet = new Set<string>();
  for (const productos of transacciones.values()) {
    for (const producto of productos) {
      productoFrecuencia.set(producto, (productoFrecuencia.get(producto) || 0) + 1);
      productoSet.add(producto);
    }
  }

  // Contar coocurrencias de pares
  const parCoocurrencias = new Map<string, number>();
  for (const productos of transacciones.values()) {
    const productosArray = Array.from(productos);
    for (let i = 0; i < productosArray.length; i++) {
      for (let j = i + 1; j < productosArray.length; j++) {
        const key = [productosArray[i], productosArray[j]].sort().join('||');
        parCoocurrencias.set(key, (parCoocurrencias.get(key) || 0) + 1);
      }
    }
  }

  // Calcular métricas para cada par
  const pares: BasketPair[] = [];
  for (const [key, coocurrencias] of parCoocurrencias) {
    const [productoA, productoB] = key.split('||');

    const soporte = coocurrencias / totalTransacciones;
    if (soporte < minSoporte) continue;

    const freqA = productoFrecuencia.get(productoA) || 0;
    const freqB = productoFrecuencia.get(productoB) || 0;

    const confianzaAB = freqA > 0 ? coocurrencias / freqA : 0;
    const confianzaBA = freqB > 0 ? coocurrencias / freqB : 0;
    const confianza = Math.max(confianzaAB, confianzaBA);

    if (confianza < minConfianza) continue;

    const probB = freqB / totalTransacciones;
    const levantamiento = probB > 0 ? confianzaAB / probB : 0;

    pares.push({
      productoA,
      productoB,
      coocurrencias,
      soporte: Math.round(soporte * 10000) / 10000,
      confianza: Math.round(confianza * 10000) / 10000,
      levantamiento: Math.round(levantamiento * 10000) / 10000,
    });
  }

  // Ordenar por levantamiento (más relevante primero)
  pares.sort((a, b) => b.levantamiento - a.levantamiento);

  return {
    pares,
    totalTransacciones,
    totalProductosUnicos: productoSet.size,
  };
}

/**
 * @description Sugiere productos relacionados basados en el basket analysis.
 * @param {BasketPair[]} pares - Pares de productos del análisis.
 * @param {string} productoId - Producto para el cual buscar sugerencias.
 * @param {number} maxSugerencias - Máximo de sugerencias.
 * @returns {string[]} IDs de productos sugeridos.
 */
export function sugerirProductos(
  pares: BasketPair[],
  productoId: string,
  maxSugerencias: number = 5
): string[] {
  const sugerencias = pares
    .filter(
      (par) =>
        par.productoA === productoId || par.productoB === productoId
    )
    .map((par) => ({
      productoId: par.productoA === productoId ? par.productoB : par.productoA,
      levantamiento: par.levantamiento,
    }))
    .sort((a, b) => b.levantamiento - a.levantamiento)
    .slice(0, maxSugerencias)
    .map((s) => s.productoId);

  return sugerencias;
}

/**
 * @description Filtra pares con levantamiento > 1 (productos que se compran
 * juntos más de lo esperado por azar).
 * @param {BasketPair[]} pares - Todos los pares.
 * @returns {BasketPair[]} Pares con levantamiento significativo.
 */
export function paresSignificativos(pares: BasketPair[]): BasketPair[] {
  return pares.filter((par) => par.levantamiento > 1);
}
