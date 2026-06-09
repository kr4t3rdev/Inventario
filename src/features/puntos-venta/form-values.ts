import { z } from "zod"

import { pvSchema, type PvInput } from "@/features/puntos-venta/schemas"

export const ptoVentaFormValuesSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  ubicacion: z.string().optional().nullable(),
  listaPrecioId: z.union([z.string(), z.literal("default")]).optional().nullable(),
})

export type PtoVentaFormValues = z.infer<typeof ptoVentaFormValuesSchema>

export function toPvInput(values: PtoVentaFormValues): PvInput {
  return {
    nombre: values.nombre,
    ubicacion: values.ubicacion?.trim() ? values.ubicacion : null,
    listaPrecioId:
      values.listaPrecioId === "default" || !values.listaPrecioId
        ? null
        : values.listaPrecioId,
  }
}

export function parsePvFormValues(values: PtoVentaFormValues): PvInput {
  return pvSchema.parse(toPvInput(values))
}
