
# SaleCreateRequest


## Properties

Name | Type
------------ | -------------
`puntoDeVentaId` | string
`clienteId` | string
`empleadoId` | string
`descuento` | number
`observaciones` | string
`items` | [Array&lt;SaleItemRequest&gt;](SaleItemRequest.md)
`turnoId` | string
`metodoPago` | string
`montoEfectivo` | number
`montoTarjeta` | number
`montoTransferencia` | number
`montoCredito` | number
`tipoVencimiento` | string
`fechaVencimiento` | string
`cuentaBancariaId` | string

## Example

```typescript
import type { SaleCreateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "puntoDeVentaId": null,
  "clienteId": null,
  "empleadoId": null,
  "descuento": null,
  "observaciones": null,
  "items": null,
  "turnoId": null,
  "metodoPago": null,
  "montoEfectivo": null,
  "montoTarjeta": null,
  "montoTransferencia": null,
  "montoCredito": null,
  "tipoVencimiento": null,
  "fechaVencimiento": null,
  "cuentaBancariaId": null,
} satisfies SaleCreateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaleCreateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


