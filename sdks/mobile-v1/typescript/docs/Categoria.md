
# Categoria

Categoría de producto.

## Properties

Name | Type
------------ | -------------
`categoryId` | string
`nombre` | string
`descripcion` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Categoria } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "categoryId": null,
  "nombre": null,
  "descripcion": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Categoria

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Categoria
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


