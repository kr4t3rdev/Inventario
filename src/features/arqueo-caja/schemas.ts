/**
 * @description Schemas Zod para la feature de Arqueo de Caja.
 */
import { z } from "zod";

/** Schema para el conteo de billetes CUP */
const conteoCupSchema = z.object({
	billetes1000Cup: z.coerce.number().int().min(0).default(0),
	billetes500Cup: z.coerce.number().int().min(0).default(0),
	billetes200Cup: z.coerce.number().int().min(0).default(0),
	billetes100Cup: z.coerce.number().int().min(0).default(0),
	billetes50Cup: z.coerce.number().int().min(0).default(0),
	billetes20Cup: z.coerce.number().int().min(0).default(0),
	billetes10Cup: z.coerce.number().int().min(0).default(0),
	billetes5Cup: z.coerce.number().int().min(0).default(0),
	billetes1Cup: z.coerce.number().int().min(0).default(0),
	monedasCup: z.coerce.number().int().min(0).default(0),
});

/** Schema para el conteo de billetes USD */
const conteoUsdSchema = z.object({
	billetes100Usd: z.coerce.number().int().min(0).default(0),
	billetes50Usd: z.coerce.number().int().min(0).default(0),
	billetes20Usd: z.coerce.number().int().min(0).default(0),
	billetes10Usd: z.coerce.number().int().min(0).default(0),
	billetes5Usd: z.coerce.number().int().min(0).default(0),
	billetes1Usd: z.coerce.number().int().min(0).default(0),
	monedasUsd: z.coerce.number().int().min(0).default(0),
});

/** Schema completo para realizar un arqueo de caja */
export const realizarArqueoSchema = z.object({
	turnoId: z.string().min(1, "El turno es requerido"),
	// Conteo CUP
	...conteoCupSchema.shape,
	// Conteo USD
	...conteoUsdSchema.shape,
	// Totales no-efectivo
	totalTarjeta: z.coerce.number().int().min(0).default(0),
	totalTransferencia: z.coerce.number().int().min(0).default(0),
	totalCredito: z.coerce.number().int().min(0).default(0),
	// Control
	observaciones: z.string().max(500).optional().nullable(),
});

/** Schema para listar arqueos con filtros */
export const listarArqueosSchema = z.object({
	fechaDesde: z.string().optional(),
	fechaHasta: z.string().optional(),
	puntoDeVentaId: z.string().optional(),
	soloConDiferencia: z.coerce.boolean().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type ListarArqueosInput = z.infer<typeof listarArqueosSchema>;

export type RealizarArqueoInput = z.infer<typeof realizarArqueoSchema>;
export type ConteoCupInput = z.infer<typeof conteoCupSchema>;
export type ConteoUsdInput = z.infer<typeof conteoUsdSchema>;
