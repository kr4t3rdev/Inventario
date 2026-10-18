
# UpdateAdminTenantRequest


## Properties

Name | Type
------------ | -------------
`tenantId` | string
`nombre` | string
`slug` | string
`regimenFiscal` | string
`taxId` | string
`razonSocial` | string
`codigoPostalFiscal` | string
`fiscalActivado` | boolean
`contabilidadTimezone` | string

## Example

```typescript
import type { UpdateAdminTenantRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantId": null,
  "nombre": null,
  "slug": null,
  "regimenFiscal": null,
  "taxId": null,
  "razonSocial": null,
  "codigoPostalFiscal": null,
  "fiscalActivado": null,
  "contabilidadTimezone": null,
} satisfies UpdateAdminTenantRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateAdminTenantRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


