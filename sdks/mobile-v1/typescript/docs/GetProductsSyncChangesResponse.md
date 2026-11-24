
# GetProductsSyncChangesResponse

Página de eventos y cursor reanudable.

## Properties

Name | Type
------------ | -------------
`changes` | [Array&lt;MobileProductSyncChange&gt;](MobileProductSyncChange.md)
`cursor` | string

## Example

```typescript
import type { GetProductsSyncChangesResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "changes": null,
  "cursor": null,
} satisfies GetProductsSyncChangesResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetProductsSyncChangesResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


