
# CashOperationUpdateRequest


## Properties

Name | Type
------------ | -------------
`fechaVencimiento` | Date
`tasaInteres` | number
`observaciones` | string

## Example

```typescript
import type { CashOperationUpdateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "fechaVencimiento": null,
  "tasaInteres": null,
  "observaciones": null,
} satisfies CashOperationUpdateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CashOperationUpdateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


