/**
 * @description Schema Zod y tipos para el formulario de productos.
 * Separado de productos-form.tsx para mantener el componente principal pequeño.
 *
 * @module features/productos/components/productos-form-schema
 */

import { z } from "zod";

/**
 * @description Construye el schema de validación para el formulario de productos.
 * Si usa EAN-13, ciertos campos pasan a ser requeridos.
 *
 * @param {boolean} usaEan13 - Si el tenant usa códigos EAN-13
 * @returns {z.ZodObject} Schema de validación
 */
export function buildProductosSchema(usaEan13: boolean) {
	const baseSchema = {
		nombre: z
			.string()
			.min(1, "El nombre del producto es obligatorio")
			.max(120, "El nombre no puede tener más de 120 caracteres"),
		descripcion: z.string().max(5000).optional().default(""),
		codigoInterno: z.string().optional().default(""),
		proveedorCodigo: z.string().optional().default(""),
		vendorId: z.string().optional().default(""),
		categoriaId: z.string().min(1, "La categoría es obligatoria"),
		subcategoriaId: z.string().optional().default(""),
		precioCosto: z.coerce
			.number()
			.min(0, "El precio de costo no puede ser negativo")
			.optional(),
		precioVenta: z.coerce
			.number()
			.min(0.01, "El precio de venta debe ser mayor a 0"),
		stock: z.coerce.number().min(0, "El stock no puede ser negativo"),
		stockMinimo: z.coerce
			.number()
			.min(0, "El stock mínimo no puede ser negativo"),
		fotos: z.array(z.string()).optional().default([]),
		unidadId: z.string().min(1, "La unidad de medida es obligatoria"),
		almacenId: z.string().min(1, "El almacén es obligatorio"),
	};

	// Si usa EAN-13, codigoInterno es requerido
	if (usaEan13) {
		return z.object({
			...baseSchema,
			codigoInterno: z
				.string()
				.min(1, "El código interno es obligatorio con EAN-13"),
		});
	}

	return z.object(baseSchema);
}

export type ProductosFormValues = z.infer<
	ReturnType<typeof buildProductosSchema>
>;
