
# DashboardVentasDiarias

Métricas de ventas diarias (últimos 60 días).

## Properties

Name | Type
------------ | -------------
`ventasHoy` | number
`ingresosHoy` | number
`ventasAyer` | number
`ingresosAyer` | number
`promedioVentasDiarias` | number
`promedioIngresosDiarios` | number
`diasConVentas` | number
`totalDias` | number
`totalIngresosPeriodo` | number
`totalCantidadPeriodo` | number

## Example

```typescript
import type { DashboardVentasDiarias } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ventasHoy": null,
  "ingresosHoy": null,
  "ventasAyer": null,
  "ingresosAyer": null,
  "promedioVentasDiarias": null,
  "promedioIngresosDiarios": null,
  "diasConVentas": null,
  "totalDias": null,
  "totalIngresosPeriodo": null,
  "totalCantidadPeriodo": null,
} satisfies DashboardVentasDiarias

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardVentasDiarias
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


