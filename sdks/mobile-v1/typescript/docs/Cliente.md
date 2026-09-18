
# Cliente


## Properties

Name | Type
------------ | -------------
`clienteId` | string
`nombre` | string
`direccion` | string
`telefono` | string
`logoUrl` | string
`numeroCuentaCUP` | string
`numeroCuentaUSD` | string
`numeroContrato` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Cliente } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "clienteId": null,
  "nombre": null,
  "direccion": null,
  "telefono": null,
  "logoUrl": null,
  "numeroCuentaCUP": null,
  "numeroCuentaUSD": null,
  "numeroContrato": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Cliente

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Cliente
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


