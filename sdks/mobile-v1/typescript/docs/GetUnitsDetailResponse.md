
# GetUnitsDetailResponse

GET /units/{id}.

## Properties

Name | Type
------------ | -------------
`unit` | [Unit](Unit.md)

## Example

```typescript
import type { GetUnitsDetailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "unit": null,
} satisfies GetUnitsDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetUnitsDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


