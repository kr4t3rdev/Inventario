
# SaleReconciliationRequest


## Properties

Name | Type
------------ | -------------
`ventaId` | string
`cuentaId` | string
`tipoPagoId` | string
`monto` | number
`moneda` | string
`fechaReconciliacion` | Date
`observaciones` | string

## Example

```typescript
import type { SaleReconciliationRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ventaId": null,
  "cuentaId": null,
  "tipoPagoId": null,
  "monto": null,
  "moneda": null,
  "fechaReconciliacion": null,
  "observaciones": null,
} satisfies SaleReconciliationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaleReconciliationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


