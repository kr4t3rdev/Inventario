import { describe, expect, it } from "vitest"

import { toPvInput } from "@/features/puntos-venta/form-values"

describe("toPvInput", () => {
  it('mapea el sentinel "default" a null', () => {
    expect(
      toPvInput({
        nombre: "Sucursal Centro",
        ubicacion: "Av. Principal",
        listaPrecioId: "default",
      }),
    ).toEqual({
      nombre: "Sucursal Centro",
      ubicacion: "Av. Principal",
      listaPrecioId: null,
    })
  })

  it("convierte campos vacíos opcionales en null", () => {
    expect(
      toPvInput({
        nombre: "Sucursal Norte",
        ubicacion: "",
        listaPrecioId: "",
      }),
    ).toEqual({
      nombre: "Sucursal Norte",
      ubicacion: null,
      listaPrecioId: null,
    })
  })

  it("preserva una lista de precios real", () => {
    expect(
      toPvInput({
        nombre: "Sucursal Sur",
        ubicacion: null,
        listaPrecioId: "lp-1",
      }),
    ).toEqual({
      nombre: "Sucursal Sur",
      ubicacion: null,
      listaPrecioId: "lp-1",
    })
  })
})
