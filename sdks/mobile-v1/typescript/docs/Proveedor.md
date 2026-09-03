
# Proveedor


## Properties

Name | Type
------------ | -------------
`vendorId` | string
`nombre` | string
`contacto` | string
`direccion` | string
`telefono` | string
`cuentaCUP` | string
`cuentaUSD` | string
`logo` | string
`contrato` | string
`vendorCode` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Proveedor } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "vendorId": null,
  "nombre": null,
  "contacto": null,
  "direccion": null,
  "telefono": null,
  "cuentaCUP": null,
  "cuentaUSD": null,
  "logo": null,
  "contrato": null,
  "vendorCode": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Proveedor

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Proveedor
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


