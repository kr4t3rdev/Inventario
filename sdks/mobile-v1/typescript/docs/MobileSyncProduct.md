
# MobileSyncProduct

Proyección offline del producto. No contiene precioCosto ni otros datos de costo.

## Properties

Name | Type
------------ | -------------
`id` | string
`nombre` | string
`descripcion` | string
`precioVenta` | number
`stock` | number
`stockMinimo` | number
`codigoInterno` | string
`codigoNegocio` | string
`sku` | string
`atributoJson` | [JsonValue](JsonValue.md)
`esVariante` | boolean
`plantillaId` | string
`proveedorCodigo` | string
`idSeccionCodigo` | string
`especificoCodigo` | string
`surtidoCodigo` | string
`dcCodigo` | string
`categoriaId` | string
`subcategoriaId` | string
`unidadId` | string
`vendorId` | string
`almacenId` | string
`puntoDeVentaId` | string
`fotos` | Array&lt;string&gt;
`esCompuesto` | boolean
`createdAt` | Date
`updatedAt` | Date
`categoria` | [MobileSyncProductCategoria](MobileSyncProductCategoria.md)
`subcategoria` | [MobileSyncProductSubcategoria](MobileSyncProductSubcategoria.md)
`unidad` | [MobileSyncProductUnidad](MobileSyncProductUnidad.md)
`vendor` | [MobileSyncProductVendor](MobileSyncProductVendor.md)

## Example

```typescript
import type { MobileSyncProduct } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "nombre": null,
  "descripcion": null,
  "precioVenta": null,
  "stock": null,
  "stockMinimo": null,
  "codigoInterno": null,
  "codigoNegocio": null,
  "sku": null,
  "atributoJson": null,
  "esVariante": null,
  "plantillaId": null,
  "proveedorCodigo": null,
  "idSeccionCodigo": null,
  "especificoCodigo": null,
  "surtidoCodigo": null,
  "dcCodigo": null,
  "categoriaId": null,
  "subcategoriaId": null,
  "unidadId": null,
  "vendorId": null,
  "almacenId": null,
  "puntoDeVentaId": null,
  "fotos": null,
  "esCompuesto": null,
  "createdAt": null,
  "updatedAt": null,
  "categoria": null,
  "subcategoria": null,
  "unidad": null,
  "vendor": null,
} satisfies MobileSyncProduct

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MobileSyncProduct
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


