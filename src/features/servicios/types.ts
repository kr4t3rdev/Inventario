import type { Servicios } from '@/app/models/model';
import type { ServicioInput, ServicioUpdateInput } from './schemas';

/**
 * @description Re-export del tipo de dominio desde modelos compartidos.
 * NOTA: La interfaz Servicios en models incluye campos no persistidos
 * (precioCosto, codigoInterno, deletedAt, etc.). El contrato del módulo
 * servicios solo opera con campos persistidos en Prisma.
 */
export type { Servicios };

/**
 * @description Respuesta serializada del módulo servicios.
 * Solo incluye campos persistidos en Prisma, con Date convertido a ISO string.
 */
export interface ServicioResponse {
  servicioId: string;
  nombre: string;
  descripcion: string;
  precio: number;
  moneda: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * @description Tipos inferidos de los schemas Zod de servicios.
 * ServicioInput: payload para create (nombre, descripcion, precio, moneda?)
 * ServicioUpdateInput: payload para update (servicioId + campos opcionales)
 */
export type { ServicioInput, ServicioUpdateInput };
