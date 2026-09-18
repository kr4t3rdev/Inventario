import type { Producto } from './productos';
import type { Servicios } from './economicos';
import type { Venta } from './ventas';
import type { Cliente } from './clientes';

export interface OfertaItem {
	id: string;
	ofertaId: string;
	productoId?: string;
	servicioId?: string;
	cantidad: number;
	precioUnitario: number;
	total: number;
	producto?: Producto;
	servicio?: Servicios;
}

export interface Oferta {
	id: string;
	numeroOferta: string;
	clienteId: string;
	fechaEmision: string;
	fechaVencimiento: string | null;
	estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA" | "FACTURADA";
	subtotal: number;
	impuestos: number;
	total: number;
	observaciones: string | null;
	items: OfertaItem[];
	ventaId?: string;
	venta?: Venta;
	cliente?: Cliente;
	createdAt: string;
	updatedAt: string;
}

