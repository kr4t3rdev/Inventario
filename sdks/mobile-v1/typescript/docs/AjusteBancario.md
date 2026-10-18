
# AjusteBancario

Fila de AjusteBancario creada. Los campos Decimal se serializan como texto.

## Properties

Name | Type
------------ | -------------
`ajusteId` | string
`tenantId` | string
`cuentaId` | string
`tipo` | string
`monto` | string
`moneda` | string
`tasaCambio` | string
`montoConvertido` | string
`descripcion` | string
`motivo` | string
`realizadoPor` | string
`fechaOperacion` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { AjusteBancario } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ajusteId": null,
  "tenantId": null,
  "cuentaId": null,
  "tipo": null,
  "monto": null,
  "moneda": null,
  "tasaCambio": null,
  "montoConvertido": null,
  "descripcion": null,
  "motivo": null,
  "realizadoPor": null,
  "fechaOperacion": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies AjusteBancario

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AjusteBancario
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


