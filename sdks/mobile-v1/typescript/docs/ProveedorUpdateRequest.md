
# ProveedorUpdateRequest


## Properties

Name | Type
------------ | -------------
`nombre` | string
`contacto` | string
`direccion` | string
`telefono` | string
`cuentaCUP` | string
`cuentaUSD` | string
`logo` | string
`contrato` | string

## Example

```typescript
import type { ProveedorUpdateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "nombre": null,
  "contacto": null,
  "direccion": null,
  "telefono": null,
  "cuentaCUP": null,
  "cuentaUSD": null,
  "logo": null,
  "contrato": null,
} satisfies ProveedorUpdateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProveedorUpdateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


