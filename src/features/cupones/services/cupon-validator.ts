/**
 * @description Validación y aplicación de cupones de descuento.
 *
 * Verifica fechas, límites de uso, monto mínimo, canal aplicable
 * y segmento del cliente. Calcula el descuento según el tipo de cupón.
 *
 * @module features/cupones/services/cupon-validator
 */

export interface CuponInfo {
  cuponId: string;
  codigo: string;
  tipo: 'PORCENTAJE' | 'FIJO' | '2X1' | 'ENVIO_GRATIS' | 'PRODUCTO_GRATIS' | 'CASHBACK_PUNTOS';
  valor: number;
  usoMinimo: number | null;
  usoMaximo: number | null;
  vecesMaximo: number | null;
  vecesPorCliente: number | null;
  validoDesde: Date;
  validoHasta: Date | null;
  activo: boolean;
  aplicableA: string | null;
  filtros: Record<string, unknown> | null;
  canalAplicacion: string | null;
  segmentoTarget: string | null;
  vecesUsado: number;
}

export interface ValidacionParams {
  cupon: CuponInfo;
  totalCompra: number;
  canal: string;
  clienteId?: string | null;
  segmentoCliente?: string | null;
  productoIds?: string[];
  usosPorCliente?: number;
  ahora?: Date;
}

export interface ValidacionResultado {
  valido: boolean;
  motivoRechazo?: string;
  descuento?: number;
}

/**
 * @description Valida un cupón contra todas las reglas de negocio.
 * @param {ValidacionParams} params - Datos del cupón y contexto de uso.
 * @returns {ValidacionResultado} Si es válido y el descuento calculado.
 */
export function validarCupon(params: ValidacionParams): ValidacionResultado {
  const { cupon, totalCompra, canal, segmentoCliente, productoIds, usosPorCliente = 0, ahora = new Date() } = params;

  // 1. ¿Está activo?
  if (!cupon.activo) {
    return { valido: false, motivoRechazo: 'El cupón no está activo' };
  }

  // 2. ¿Está en rango de fechas?
  if (ahora < cupon.validoDesde) {
    return { valido: false, motivoRechazo: 'El cupón aún no está disponible' };
  }
  if (cupon.validoHasta && ahora > cupon.validoHasta) {
    return { valido: false, motivoRechazo: 'El cupón expiró' };
  }

  // 3. ¿Se excedió el límite total de usos?
  if (cupon.vecesMaximo != null && cupon.vecesUsado >= cupon.vecesMaximo) {
    return { valido: false, motivoRechazo: 'El cupón alcanzó su límite de usos' };
  }

  // 4. ¿Se excedió el límite por cliente?
  if (cupon.vecesPorCliente != null && params.clienteId && usosPorCliente >= cupon.vecesPorCliente) {
    return { valido: false, motivoRechazo: 'Ya usaste este cupón el máximo de veces permitido' };
  }

  // 5. ¿Cumple el monto mínimo de compra?
  if (cupon.usoMinimo != null && totalCompra < cupon.usoMinimo) {
    return { valido: false, motivoRechazo: `Se requiere una compra mínima de ${formatMonto(cupon.usoMinimo)}` };
  }

  // 6. ¿Es aplicable al canal?
  if (cupon.canalAplicacion && cupon.canalAplicacion !== 'TODOS' && cupon.canalAplicacion !== canal) {
    return { valido: false, motivoRechazo: 'Este cupón no es válido para este canal' };
  }

  // 7. ¿Es aplicable al segmento del cliente?
  if (cupon.segmentoTarget && segmentoCliente && cupon.segmentoTarget !== segmentoCliente) {
    return { valido: false, motivoRechazo: 'Este cupón no es válido para tu segmento' };
  }

  // 8. ¿Es aplicable a los productos del carrito?
  if (cupon.aplicableA === 'PRODUCTO' && cupon.filtros && productoIds) {
    const productoIdsFiltro = (cupon.filtros.productoIds as string[]) || [];
    const hayCoincidencia = productoIds.some((id) => productoIdsFiltro.includes(id));
    if (!hayCoincidencia) {
      return { valido: false, motivoRechazo: 'Este cupón no aplica a los productos en tu carrito' };
    }
  }

  if (cupon.aplicableA === 'CATEGORIA' && cupon.filtros && productoIds) {
    const categoriaIdsFiltro = (cupon.filtros.categoriaIds as string[]) || [];
    // Los productos del carrito deben pertenecer a las categorías filtradas.
    // Se espera que `productoIds` sea validado contra las categorías en el servicio
    // que llama a esta función (por ejemplo, venta-mutation-service), porque aquí
    // no tenemos acceso a Prisma para consultar las categorías de cada producto.
    if (categoriaIdsFiltro.length === 0) {
      return { valido: false, motivoRechazo: 'El cupón tiene un filtro de categoría inválido' };
    }
  }

  // 9. Calcular el descuento
  const descuento = calcularDescuento({
    tipo: cupon.tipo,
    valor: cupon.valor,
    totalCompra,
    usoMaximo: cupon.usoMaximo,
  });

  return { valido: true, descuento };
}

/**
 * @description Calcula el descuento monetario según el tipo de cupón.
 * Todos los montos operan en centavos para consistencia con el resto del sistema.
 * @param {object} params - Parámetros de cálculo.
 * @param {string} params.tipo - Tipo de cupón.
 * @param {number} params.valor - Valor del cupón (en centavos para FIJO/ENVIO_GRATIS; en porcentaje para PORCENTAJE).
 * @param {number} params.totalCompra - Total de la compra en centavos.
 * @param {number | null} params.usoMaximo - Descuento máximo (centavos).
 * @returns {number} Descuento en centavos.
 */
export function calcularDescuento(params: {
  tipo: string;
  valor: number;
  totalCompra: number;
  usoMaximo: number | null;
}): number {
  let descuento = 0;

  switch (params.tipo) {
    case 'PORCENTAJE':
      descuento = Math.floor((params.totalCompra * params.valor) / 100);
      break;
    case 'FIJO':
      // `valor` ya está en centavos (consistente con el resto del sistema)
      descuento = Math.floor(params.valor);
      break;
    case 'ENVIO_GRATIS':
      // El descuento es el costo de envío (valor en centavos)
      descuento = Math.floor(params.valor);
      break;
    case 'CASHBACK_PUNTOS':
      // Cashback en puntos no genera descuento directo
      descuento = 0;
      break;
    case '2X1':
    case 'PRODUCTO_GRATIS':
      // Estos tipos requieren lógica especial en el carrito
      descuento = 0;
      break;
    default:
      descuento = 0;
  }

  // Aplicar límite máximo si existe
  if (params.usoMaximo != null && descuento > params.usoMaximo) {
    descuento = params.usoMaximo;
  }

  // El descuento no puede exceder el total
  if (descuento > params.totalCompra) {
    descuento = params.totalCompra;
  }

  return descuento;
}

/**
 * @description Formatea un monto en centavos a string legible.
 * @param {number} centavos - Monto en centavos.
 * @returns {string} Monto formateado.
 */
function formatMonto(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}
