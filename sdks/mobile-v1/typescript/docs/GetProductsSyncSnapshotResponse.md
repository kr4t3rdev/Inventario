
# GetProductsSyncSnapshotResponse

Página de snapshot con un cursor base para recibir cambios posteriores.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;MobileSyncProduct&gt;](MobileSyncProduct.md)
`nextPageToken` | string
`changesCursor` | string

## Example

```typescript
import type { GetProductsSyncSnapshotResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "nextPageToken": null,
  "changesCursor": null,
} satisfies GetProductsSyncSnapshotResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetProductsSyncSnapshotResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


