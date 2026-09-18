
# Product


## Properties

Name | Type
------------ | -------------
`id` | string
`nombre` | string
`codigo` | string
`precio` | number
`costo` | number
`stock` | number
`isActive` | boolean

## Example

```typescript
import type { Product } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "nombre": null,
  "codigo": null,
  "precio": null,
  "costo": null,
  "stock": null,
  "isActive": null,
} satisfies Product

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Product
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


