import { prisma } from '@/lib/prisma';
import type { StockUbicacion } from '@/app/models/model';

export type TipoUbicacion = 'almacen' | 'punto_venta';

export interface CrearStockUbicacionInput {
  productoId: string;
  tipoUbicacion: TipoUbicacion;
  ubicacionId: string;
  cantidad?: number;
  cantidadReservada?: number;
}

export interface ActualizarStockInput {
  stockId: string;
  cantidad?: number;
  cantidadReservada?: number;
}

export interface MovimientoStockInput {
  productoId: string;
  tipoUbicacionOrigen: TipoUbicacion;
  ubicacionIdOrigen: string;
  tipoUbicacionDestino: TipoUbicacion;
  ubicacionIdDestino: string;
  cantidad: number;
  descripcion?: string;
}

/**
 * @description Obtiene el stock de un producto en una ubicación específica
 * @param {string} productoId - ID del producto
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación ('almacen' o 'punto_venta')
 * @param {string} ubicacionId - ID de la ubicación
 * @returns {Promise<StockUbicacion | null>} Stock del producto o null si no existe
 */
export async function obtenerStockUbicacion(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string
): Promise<StockUbicacion | null> {
  const stock = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
  });

  if (!stock) return null;

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Obtiene todo el stock de un producto en todas las ubicaciones
 * @param {string} productoId - ID del producto
 * @returns {Promise<StockUbicacion[]>} Lista de stocks del producto
 */
export async function obtenerStockPorProducto(
  productoId: string
): Promise<StockUbicacion[]> {
  const stocks = await prisma.stockUbicacion.findMany({
    where: { productoId },
    orderBy: { tipoUbicacion: 'asc' },
  });

  return stocks.map((stock) => ({
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  }));
}

/**
 * @description Obtiene todo el stock de una ubicación específica
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación ('almacen' o 'punto_venta')
 * @param {string} ubicacionId - ID de la ubicación
 * @returns {Promise<StockUbicacion[]>} Lista de stocks en la ubicación
 */
export async function obtenerStockPorUbicacion(
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string
): Promise<StockUbicacion[]> {
  const stocks = await prisma.stockUbicacion.findMany({
    where: { tipoUbicacion, ubicacionId },
    include: {
      producto: {
        select: {
          id: true,
          nombre: true,
          precioVenta: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return stocks.map((stock) => ({
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  }));
}

/**
 * @description Crea o actualiza el stock de un producto en una ubicación
 * @param {CrearStockUbicacionInput} input - Datos del stock
 * @returns {Promise<StockUbicacion>} Stock creado o actualizado
 */
export async function crearOActualizarStockUbicacion(
  input: CrearStockUbicacionInput
): Promise<StockUbicacion> {
  const cantidad = input.cantidad ?? 0;
  const cantidadReservada = input.cantidadReservada ?? 0;
  const cantidadDisponible = cantidad - cantidadReservada;

  const stock = await prisma.stockUbicacion.upsert({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId: input.productoId,
        tipoUbicacion: input.tipoUbicacion,
        ubicacionId: input.ubicacionId,
      },
    },
    update: {
      cantidad,
      cantidadReservada,
      cantidadDisponible,
      ultimaActualizacion: new Date(),
    },
    create: {
      productoId: input.productoId,
      tipoUbicacion: input.tipoUbicacion,
      ubicacionId: input.ubicacionId,
      cantidad,
      cantidadReservada,
      cantidadDisponible,
    },
  });

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Incrementa el stock de un producto en una ubicación
 * @param {string} productoId - ID del producto
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación
 * @param {string} ubicacionId - ID de la ubicación
 * @param {number} cantidad - Cantidad a incrementar
 * @returns {Promise<StockUbicacion>} Stock actualizado
 */
export async function incrementarStock(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string,
  cantidad: number
): Promise<StockUbicacion> {
  const stockActual = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
  });

  if (!stockActual) {
    return crearOActualizarStockUbicacion({
      productoId,
      tipoUbicacion,
      ubicacionId,
      cantidad,
    });
  }

  const nuevaCantidad = stockActual.cantidad + cantidad;
  const cantidadDisponible = nuevaCantidad - stockActual.cantidadReservada;

  const stock = await prisma.stockUbicacion.update({
    where: {
      stockId: stockActual.stockId,
    },
    data: {
      cantidad: nuevaCantidad,
      cantidadDisponible,
      ultimaActualizacion: new Date(),
    },
  });

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Decrementa el stock de un producto en una ubicación
 * @param {string} productoId - ID del producto
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación
 * @param {string} ubicacionId - ID de la ubicación
 * @param {number} cantidad - Cantidad a decrementar
 * @returns {Promise<StockUbicacion>} Stock actualizado
 * @throws {Error} Si no hay suficiente stock disponible
 */
export async function decrementarStock(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string,
  cantidad: number
): Promise<StockUbicacion> {
  const stockActual = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
  });

  if (!stockActual) {
    throw new Error(
      `No existe stock para el producto ${productoId} en la ubicación especificada`
    );
  }

  if (stockActual.cantidadDisponible < cantidad) {
    throw new Error(
      `Stock insuficiente. Disponible: ${stockActual.cantidadDisponible}, Solicitado: ${cantidad}`
    );
  }

  const nuevaCantidad = stockActual.cantidad - cantidad;
  const cantidadDisponible = nuevaCantidad - stockActual.cantidadReservada;

  const stock = await prisma.stockUbicacion.update({
    where: {
      stockId: stockActual.stockId,
    },
    data: {
      cantidad: nuevaCantidad,
      cantidadDisponible,
      ultimaActualizacion: new Date(),
    },
  });

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Reserva una cantidad de stock para evitar su venta
 * @param {string} productoId - ID del producto
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación
 * @param {string} ubicacionId - ID de la ubicación
 * @param {number} cantidad - Cantidad a reservar
 * @returns {Promise<StockUbicacion>} Stock actualizado
 * @throws {Error} Si no hay suficiente stock disponible
 */
export async function reservarStock(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string,
  cantidad: number
): Promise<StockUbicacion> {
  const stockActual = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
  });

  if (!stockActual) {
    throw new Error(
      `No existe stock para el producto ${productoId} en la ubicación especificada`
    );
  }

  if (stockActual.cantidadDisponible < cantidad) {
    throw new Error(
      `Stock insuficiente para reservar. Disponible: ${stockActual.cantidadDisponible}, Solicitado: ${cantidad}`
    );
  }

  const nuevaCantidadReservada = stockActual.cantidadReservada + cantidad;
  const cantidadDisponible = stockActual.cantidad - nuevaCantidadReservada;

  const stock = await prisma.stockUbicacion.update({
    where: {
      stockId: stockActual.stockId,
    },
    data: {
      cantidadReservada: nuevaCantidadReservada,
      cantidadDisponible,
      ultimaActualizacion: new Date(),
    },
  });

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Libera una reserva de stock
 * @param {string} productoId - ID del producto
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación
 * @param {string} ubicacionId - ID de la ubicación
 * @param {number} cantidad - Cantidad a liberar
 * @returns {Promise<StockUbicacion>} Stock actualizado
 */
export async function liberarReservaStock(
  productoId: string,
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string,
  cantidad: number
): Promise<StockUbicacion> {
  const stockActual = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
  });

  if (!stockActual) {
    throw new Error(
      `No existe stock para el producto ${productoId} en la ubicación especificada`
    );
  }

  const nuevaCantidadReservada = Math.max(0, stockActual.cantidadReservada - cantidad);
  const cantidadDisponible = stockActual.cantidad - nuevaCantidadReservada;

  const stock = await prisma.stockUbicacion.update({
    where: {
      stockId: stockActual.stockId,
    },
    data: {
      cantidadReservada: nuevaCantidadReservada,
      cantidadDisponible,
      ultimaActualizacion: new Date(),
    },
  });

  return {
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

/**
 * @description Transfiere stock entre ubicaciones
 * @param {MovimientoStockInput} input - Datos del movimiento
 * @returns {Promise<{ origen: StockUbicacion; destino: StockUbicacion }>} Stocks actualizados
 */
export async function transferirStock(
  input: MovimientoStockInput
): Promise<{ origen: StockUbicacion; destino: StockUbicacion }> {
  const resultado = await prisma.$transaction(async (tx) => {
    const stockOrigen = await tx.stockUbicacion.findUnique({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: input.productoId,
          tipoUbicacion: input.tipoUbicacionOrigen,
          ubicacionId: input.ubicacionIdOrigen,
        },
      },
    });

    if (!stockOrigen) {
      throw new Error(
        `No existe stock para el producto ${input.productoId} en la ubicación de origen`
      );
    }

    if (stockOrigen.cantidadDisponible < input.cantidad) {
      throw new Error(
        `Stock insuficiente en origen. Disponible: ${stockOrigen.cantidadDisponible}, Solicitado: ${input.cantidad}`
      );
    }

    const nuevaCantidadOrigen = stockOrigen.cantidad - input.cantidad;
    const cantidadDisponibleOrigen = nuevaCantidadOrigen - stockOrigen.cantidadReservada;

    const stockOrigenActualizado = await tx.stockUbicacion.update({
      where: { stockId: stockOrigen.stockId },
      data: {
        cantidad: nuevaCantidadOrigen,
        cantidadDisponible: cantidadDisponibleOrigen,
        ultimaActualizacion: new Date(),
      },
    });

    let stockDestino = await tx.stockUbicacion.findUnique({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: input.productoId,
          tipoUbicacion: input.tipoUbicacionDestino,
          ubicacionId: input.ubicacionIdDestino,
        },
      },
    });

    if (stockDestino) {
      const nuevaCantidadDestino = stockDestino.cantidad + input.cantidad;
      const cantidadDisponibleDestino = nuevaCantidadDestino - stockDestino.cantidadReservada;

      stockDestino = await tx.stockUbicacion.update({
        where: { stockId: stockDestino.stockId },
        data: {
          cantidad: nuevaCantidadDestino,
          cantidadDisponible: cantidadDisponibleDestino,
          ultimaActualizacion: new Date(),
        },
      });
    } else {
      stockDestino = await tx.stockUbicacion.create({
        data: {
          productoId: input.productoId,
          tipoUbicacion: input.tipoUbicacionDestino,
          ubicacionId: input.ubicacionIdDestino,
          cantidad: input.cantidad,
          cantidadReservada: 0,
          cantidadDisponible: input.cantidad,
        },
      });
    }

    return { origen: stockOrigenActualizado, destino: stockDestino };
  });

  return {
    origen: {
      stockId: resultado.origen.stockId,
      productoId: resultado.origen.productoId,
      tipoUbicacion: resultado.origen.tipoUbicacion as TipoUbicacion,
      ubicacionId: resultado.origen.ubicacionId,
      cantidad: resultado.origen.cantidad,
      cantidadReservada: resultado.origen.cantidadReservada,
      cantidadDisponible: resultado.origen.cantidadDisponible,
      ultimaActualizacion: resultado.origen.ultimaActualizacion.toISOString(),
      createdAt: resultado.origen.createdAt.toISOString(),
      updatedAt: resultado.origen.updatedAt.toISOString(),
    },
    destino: {
      stockId: resultado.destino.stockId,
      productoId: resultado.destino.productoId,
      tipoUbicacion: resultado.destino.tipoUbicacion as TipoUbicacion,
      ubicacionId: resultado.destino.ubicacionId,
      cantidad: resultado.destino.cantidad,
      cantidadReservada: resultado.destino.cantidadReservada,
      cantidadDisponible: resultado.destino.cantidadDisponible,
      ultimaActualizacion: resultado.destino.ultimaActualizacion.toISOString(),
      createdAt: resultado.destino.createdAt.toISOString(),
      updatedAt: resultado.destino.updatedAt.toISOString(),
    },
  };
}

/**
 * @description Obtiene productos con stock bajo en una ubicación
 * @param {TipoUbicacion} tipoUbicacion - Tipo de ubicación
 * @param {string} ubicacionId - ID de la ubicación
 * @returns {Promise<Array<StockUbicacion & { producto: { nombre: string; stockMinimo: number } }>>} Productos con stock bajo
 */
export async function obtenerStockBajo(
  tipoUbicacion: TipoUbicacion,
  ubicacionId: string
): Promise<Array<StockUbicacion & { producto: { nombre: string; stockMinimo: number } }>> {
  const stocks = await prisma.stockUbicacion.findMany({
    where: {
      tipoUbicacion,
      ubicacionId,
      producto: {
        stockMinimo: {
          gt: 0,
        },
      },
    },
    include: {
      producto: {
        select: {
          nombre: true,
          stockMinimo: true,
        },
      },
    },
  });

  const stockBajo = stocks.filter(
    (stock) => stock.cantidadDisponible <= stock.producto.stockMinimo
  );

  return stockBajo.map((stock) => ({
    stockId: stock.stockId,
    productoId: stock.productoId,
    tipoUbicacion: stock.tipoUbicacion as TipoUbicacion,
    ubicacionId: stock.ubicacionId,
    cantidad: stock.cantidad,
    cantidadReservada: stock.cantidadReservada,
    cantidadDisponible: stock.cantidadDisponible,
    ultimaActualizacion: stock.ultimaActualizacion.toISOString(),
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
    producto: {
      nombre: stock.producto.nombre,
      stockMinimo: stock.producto.stockMinimo,
    },
  }));
}

/**
 * @description Sincroniza el stock total del producto sumando todas las ubicaciones
 * @param {string} productoId - ID del producto
 * @returns {Promise<number>} Stock total del producto
 */
export async function sincronizarStockProducto(productoId: string): Promise<number> {
  const stocks = await prisma.stockUbicacion.findMany({
    where: { productoId },
  });

  const stockTotal = stocks.reduce((sum, stock) => sum + stock.cantidad, 0);

  await prisma.producto.update({
    where: { id: productoId },
    data: { stock: stockTotal },
  });

  return stockTotal;
}
