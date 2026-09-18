
# ExpenseReconciliationRequest


## Properties

Name | Type
------------ | -------------
`tipoGasto` | string
`pgId` | string
`gastosDEId` | string
`gastoCompraId` | string
`referenciaId` | string
`cuentaId` | string
`tipoPagoId` | string
`monto` | number
`moneda` | string
`tasaCambio` | number
`descripcion` | string
`periodo` | string
`observaciones` | string
`estado` | string
`cuentaPorPagarId` | string
`numeroTransaccion` | string
`distribucion` | [Array&lt;ExpenseDistributionRequest&gt;](ExpenseDistributionRequest.md)

## Example

```typescript
import type { ExpenseReconciliationRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tipoGasto": null,
  "pgId": null,
  "gastosDEId": null,
  "gastoCompraId": null,
  "referenciaId": null,
  "cuentaId": null,
  "tipoPagoId": null,
  "monto": null,
  "moneda": null,
  "tasaCambio": null,
  "descripcion": null,
  "periodo": null,
  "observaciones": null,
  "estado": null,
  "cuentaPorPagarId": null,
  "numeroTransaccion": null,
  "distribucion": null,
} satisfies ExpenseReconciliationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExpenseReconciliationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


