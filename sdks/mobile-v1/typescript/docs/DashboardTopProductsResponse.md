
# DashboardTopProductsResponse

Respuesta de GET /dashboard/top-products.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;DashboardTopProduct&gt;](DashboardTopProduct.md)

## Example

```typescript
import type { DashboardTopProductsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
} satisfies DashboardTopProductsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DashboardTopProductsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


