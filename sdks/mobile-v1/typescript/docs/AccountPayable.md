
# AccountPayable


## Properties

Name | Type
------------ | -------------
`cuentaPorPagarId` | string
`numeroFactura` | string
`montoDeuda` | number
`montoPagado` | number
`saldoPendiente` | number
`moneda` | string
`estado` | string
`fechaVencimiento` | string

## Example

```typescript
import type { AccountPayable } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "cuentaPorPagarId": null,
  "numeroFactura": null,
  "montoDeuda": null,
  "montoPagado": null,
  "saldoPendiente": null,
  "moneda": null,
  "estado": null,
  "fechaVencimiento": null,
} satisfies AccountPayable

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AccountPayable
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


