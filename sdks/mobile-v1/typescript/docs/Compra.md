
# Compra

Compra.

## Properties

Name | Type
------------ | -------------
`compraId` | string
`numeroFactura` | string
`proveedorId` | string
`proveedorNombre` | string
`fechaCompra` | string
`estado` | string
`tipoOperacion` | string
`formaPago` | string
`subtotal` | number
`impuestos` | number
`total` | number
`createdAt` | Date

## Example

```typescript
import type { Compra } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "compraId": null,
  "numeroFactura": null,
  "proveedorId": null,
  "proveedorNombre": null,
  "fechaCompra": null,
  "estado": null,
  "tipoOperacion": null,
  "formaPago": null,
  "subtotal": null,
  "impuestos": null,
  "total": null,
  "createdAt": null,
} satisfies Compra

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Compra
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


