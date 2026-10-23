
# CapitalInjectionCreateRequest


## Properties

Name | Type
------------ | -------------
`montoRecibido` | number
`moneda` | string
`tipo` | string
`descripcion` | string
`cuentaId` | string
`socio` | string
`entidadPrestamista` | string
`tasaInteres` | number
`tasaCambio` | number
`plazoMeses` | number
`fechaInicioPago` | Date
`fechaOperacion` | Date
`idempotencyKey` | string

## Example

```typescript
import type { CapitalInjectionCreateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "montoRecibido": null,
  "moneda": null,
  "tipo": null,
  "descripcion": null,
  "cuentaId": null,
  "socio": null,
  "entidadPrestamista": null,
  "tasaInteres": null,
  "tasaCambio": null,
  "plazoMeses": null,
  "fechaInicioPago": null,
  "fechaOperacion": null,
  "idempotencyKey": null,
} satisfies CapitalInjectionCreateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CapitalInjectionCreateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


