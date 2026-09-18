
# ServiceReconciliationRequest


## Properties

Name | Type
------------ | -------------
`ventaServicioId` | string
`distribuciones` | [Array&lt;ServiceDistributionRequest&gt;](ServiceDistributionRequest.md)
`fechaReconciliacion` | Date

## Example

```typescript
import type { ServiceReconciliationRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ventaServicioId": null,
  "distribuciones": null,
  "fechaReconciliacion": null,
} satisfies ServiceReconciliationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ServiceReconciliationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


