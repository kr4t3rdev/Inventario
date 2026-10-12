
# CapitalInjectionCreateRequest

Alta de inyección de capital. socio es obligatorio cuando tipo=CAPITAL_SOCIAL; entidadPrestamista cuando tipo=DEUDA_EXTERNA.

## Properties

Name | Type
------------ | -------------
`montoRecibido` | number
`moneda` | string
`tipo` | string
`cuentaId` | string
`descripcion` | string
`socio` | string
`entidadPrestamista` | string
`tasaInteres` | number
`plazoMeses` | number
`fechaInicioPago` | Date
`fechaOperacion` | Date

## Example

```typescript
import type { CapitalInjectionCreateRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "montoRecibido": null,
  "moneda": null,
  "tipo": null,
  "cuentaId": null,
  "descripcion": null,
  "socio": null,
  "entidadPrestamista": null,
  "tasaInteres": null,
  "plazoMeses": null,
  "fechaInicioPago": null,
  "fechaOperacion": null,
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


