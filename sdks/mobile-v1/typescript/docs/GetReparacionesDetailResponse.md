
# GetReparacionesDetailResponse

GET /reparaciones/{id}.

## Properties

Name | Type
------------ | -------------
`orden` | [OrdenReparacion](OrdenReparacion.md)

## Example

```typescript
import type { GetReparacionesDetailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "orden": null,
} satisfies GetReparacionesDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetReparacionesDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


