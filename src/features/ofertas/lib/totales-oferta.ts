/**
 * @description Calculadora pura de totales de oferta (E-3). El servidor es la
 * única autoridad de la aritmética: los totales por línea, el subtotal y el
 * total finales se calculan aquí; el payload del cliente solo aporta la
 * declaración de impuestos, que se valida contra el subtotal.
 */

export interface LineaResueltaInput {
  cantidad: number;
  precioUnitario: number;
}

export interface LineaCalculada extends LineaResueltaInput {
  total: number;
}

export type CalculoTotales =
  | { ok: true; lineas: LineaCalculada[]; subtotal: number; impuestos: number; total: number }
  | { ok: false; code: 'TAX_INVALID'; message: string };

const redondear2 = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * @description Calcula líneas totales, subtotal y total de una oferta, validando
 * la declaración de impuestos del cliente (0 ≤ impuestos ≤ subtotal).
 * @param {LineaResueltaInput[]} lineas - Ítems ya resueltos a precio vigente.
 * @param {number} impuestosDeclarados - Monto de impuestos declarado por el cliente.
 * @returns {CalculoTotales} Totales listos para persistir, o TAX_INVALID.
 */
export function calcularTotalesOferta(
  entrada: LineaResueltaInput[],
  impuestosDeclarados: number,
): CalculoTotales {
  const lineas: LineaCalculada[] = entrada.map((linea) => ({
    cantidad: linea.cantidad,
    precioUnitario: linea.precioUnitario,
    total: redondear2(linea.cantidad * linea.precioUnitario),
  }));

  const subtotal = redondear2(lineas.reduce((suma, linea) => suma + linea.total, 0));
  const impuestos = redondear2(impuestosDeclarados);

  if (!Number.isFinite(impuestos) || impuestos < 0 || impuestos > subtotal) {
    return {
      ok: false,
      code: 'TAX_INVALID',
      message: `Los impuestos declarados (${impuestosDeclarados}) deben estar entre 0 y el subtotal calculado (${subtotal}).`,
    };
  }

  return { ok: true, lineas, subtotal, impuestos, total: redondear2(subtotal + impuestos) };
}
