
# PostAccountingCapitalInjectionsResponse

Respuesta de POST /accounting/capital-injections: fila de InyeccionCapital creada. Los campos Decimal se serializan como texto.

## Properties

Name | Type
------------ | -------------
`id` | string
`tenantId` | string
`tipo` | string
`montoRecibido` | string
`moneda` | string
`tasaInteres` | string
`montoInteres` | string
`montoTotalDeuda` | string
`saldoPendiente` | string
`plazoMeses` | number
`fechaInicioPago` | Date
`socio` | string
`entidadPrestamista` | string
`cuentaId` | string
`estado` | string
`descripcion` | string
`fechaRegistro` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { PostAccountingCapitalInjectionsResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "tenantId": null,
  "tipo": null,
  "montoRecibido": null,
  "moneda": null,
  "tasaInteres": null,
  "montoInteres": null,
  "montoTotalDeuda": null,
  "saldoPendiente": null,
  "plazoMeses": null,
  "fechaInicioPago": null,
  "socio": null,
  "entidadPrestamista": null,
  "cuentaId": null,
  "estado": null,
  "descripcion": null,
  "fechaRegistro": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies PostAccountingCapitalInjectionsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAccountingCapitalInjectionsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


