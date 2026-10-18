
# Factura

Factura.

## Properties

Name | Type
------------ | -------------
`facturaId` | string
`numeroFactura` | string
`tipoDocumento` | string
`ventaId` | string
`clienteId` | string
`clienteNombre` | string
`subtotal` | number
`impuestos` | number
`descuento` | number
`total` | number
`estado` | string
`fechaEmision` | Date
`fechaVencimiento` | string
`observaciones` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Factura } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "facturaId": null,
  "numeroFactura": null,
  "tipoDocumento": null,
  "ventaId": null,
  "clienteId": null,
  "clienteNombre": null,
  "subtotal": null,
  "impuestos": null,
  "descuento": null,
  "total": null,
  "estado": null,
  "fechaEmision": null,
  "fechaVencimiento": null,
  "observaciones": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Factura

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Factura
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


