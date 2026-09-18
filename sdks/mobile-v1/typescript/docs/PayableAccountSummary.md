
# PayableAccountSummary


## Properties

Name | Type
------------ | -------------
`cuentaPorPagarId` | string
`estado` | string
`montoPagado` | number
`saldoPendiente` | number

## Example

```typescript
import type { PayableAccountSummary } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "cuentaPorPagarId": null,
  "estado": null,
  "montoPagado": null,
  "saldoPendiente": null,
} satisfies PayableAccountSummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PayableAccountSummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


