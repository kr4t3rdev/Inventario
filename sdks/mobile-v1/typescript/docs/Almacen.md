
# Almacen


## Properties

Name | Type
------------ | -------------
`almacenId` | string
`nombre` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Almacen } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "almacenId": null,
  "nombre": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Almacen

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Almacen
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


