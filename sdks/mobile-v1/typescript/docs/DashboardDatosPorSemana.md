
# DashboardDatosPorSemana

Agregado semanal del dashboard (últimas 12 semanas con actividad).

## Properties

Name | Type
------------ | -------------
`semana` | string
`ingresosVentas` | number
`ingresosServicios` | number
`gastosMermas` | number
`gastosDeExplotacion` | number
`gastosDeExplotacionCantidad` | number
`gastosCompras` | number
`gastosComprasCantidad` | number
`gastosSalarios` | number
`gastosSalariosCantidad` | number
`ventasCantidad` | number
`ventasServiciosCantidad` | number
`mermasCantidad` | number

## Example

```typescript
import type { DashboardDatosPorSemana } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "semana": null,
  "ingresosVentas": null,
  "ingresosServicios": null,
  "gastosMermas": null,
  "gastosDeExplotacion": null,
  "gastosDeExplotacionCantidad": null,
  "gastosCompras": null,
  "gastosComprasCantidad": null,
  "gastosSalarios": null,
  "gastosSalariosCantidad": null,
  "ventasCantidad": null,
  "ventasServiciosCantidad": null,
  "mermasCantidad": null,
} satisfies DashboardDatosPorSemana

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardDatosPorSemana
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


