/**
 * @description Schemas Zod para la feature de Turnos de Punto de Venta.
 */
import { z } from "zod";

/** Schema para abrir un turno */
export const abrirTurnoSchema = z.object({
	puntoDeVentaId: z.string().min(1, "El punto de venta es requerido"),
	empleadoId: z.string().optional().nullable(),
	fondoInicialCup: z.coerce
		.number()
		.int("Debe ser entero")
		.min(0, "No puede ser negativo")
		.default(0),
	fondoInicialUsd: z.coerce
		.number()
		.int("Debe ser entero")
		.min(0, "No puede ser negativo")
		.default(0),
	observaciones: z.string().max(500).optional().nullable(),
});

/** Schema para cerrar un turno */
export const cerrarTurnoSchema = z.object({
	turnoId: z.string().min(1, "El turno es requerido"),
});

/** Schema para listar turnos con filtros */
export const listarTurnosSchema = z.object({
	puntoDeVentaId: z.string().optional(),
	fecha: z.string().optional(),
	estado: z.enum(["ABIERTO", "CERRADO"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/** Schema para turno automático (uso interno) */
export const turnoAutomaticoSchema = z.object({
	puntoDeVentaId: z.string().min(1),
	empleadoId: z.string().optional().nullable(),
});

// ─── Tipos inferidos ──────────────────────────────────────

export type AbrirTurnoInput = z.infer<typeof abrirTurnoSchema>;
export type CerrarTurnoInput = z.infer<typeof cerrarTurnoSchema>;
export type ListarTurnosInput = z.infer<typeof listarTurnosSchema>;
