
# GetListasPreciosDetailResponse

GET /listas-precios/{id}.

## Properties

Name | Type
------------ | -------------
`listaPrecio` | [ListaPrecioDetail](ListaPrecioDetail.md)

## Example

```typescript
import type { GetListasPreciosDetailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "listaPrecio": null,
} satisfies GetListasPreciosDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetListasPreciosDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


