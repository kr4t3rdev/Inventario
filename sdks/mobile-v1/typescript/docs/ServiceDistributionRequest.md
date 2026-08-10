
# ServiceDistributionRequest


## Properties

Name | Type
------------ | -------------
`cuentaId` | string
`tipoPagoId` | string
`monto` | number
`moneda` | string
`observaciones` | string

## Example

```typescript
import type { ServiceDistributionRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "cuentaId": null,
  "tipoPagoId": null,
  "monto": null,
  "moneda": null,
  "observaciones": null,
} satisfies ServiceDistributionRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ServiceDistributionRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


