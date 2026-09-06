/**
 * @description Schemas Zod para ajustes de inventario y conteos físicos.
 *
 * @module features/inventario/schemas
 */
import { z } from 'zod';

export const MOTIVOS_AJUSTE = [
	'PERDIDA',
	'DANO',
	'CADUCIDAD',
	'SOBRANTE',
	'CONSUMO_INTERNO',
	'ERROR_CONTEO',
] as const;

export type MotivoAjuste = (typeof MOTIVOS_AJUSTE)[number];

export const createAjusteSchema = z.object({
	productoId: z.string().min(1),
	tipoUbicacion: z.enum(['almacen', 'punto_venta']),
	ubicacionId: z.string().min(1),
	motivo: z.enum(MOTIVOS_AJUSTE, 'El motivo debe ser uno del catálogo'),
	cantidadContada: z.coerce.number().int().min(0),
	observaciones: z.string().max(500).optional().nullable(),
});

export type CreateAjusteInput = z.infer<typeof createAjusteSchema>;

export const ESTADOS_CONTEO = [
	'BORRADOR',
	'CONTEO_1',
	'CONTEO_2',
	'CONCILIADO',
	'AJUSTADO',
	'CANCELADO',
] as const;

export const iniciarConteoSchema = z.object({
	tipoUbicacion: z.enum(['almacen', 'punto_venta']),
	ubicacionId: z.string().min(1),
	observaciones: z.string().max(500).optional().nullable(),
});
export type IniciarConteoInput = z.infer<typeof iniciarConteoSchema>;

export const registrarConteoSchema = z.object({
	conteoId: z.string().min(1),
	lineas: z
		.array(
			z.object({
				productoId: z.string().min(1),
				cantidad: z.coerce.number().int().min(0),
			}),
		)
		.min(1),
});
export type RegistrarConteoInput = z.infer<typeof registrarConteoSchema>;

export const conciliarConteoSchema = z.object({
	conteoId: z.string().min(1),
	// Puede ir vacío cuando ambas capturas coinciden en todas las líneas;
	// cualquier diferencia sin valor final se rechaza con VARIANZA_SIN_RESOLVER.
	finales: z
		.array(
			z.object({
				productoId: z.string().min(1),
				contadoFinal: z.coerce.number().int().min(0),
			}),
		)
		.default([]),
});
export type ConciliarConteoInput = z.infer<typeof conciliarConteoSchema>;
