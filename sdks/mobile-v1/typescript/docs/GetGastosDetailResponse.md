
# GetGastosDetailResponse

GET /gastos/{id}.

## Properties

Name | Type
------------ | -------------
`gasto` | [Gasto](Gasto.md)

## Example

```typescript
import type { GetGastosDetailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "gasto": null,
} satisfies GetGastosDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetGastosDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


