
# AdminTenantDetail


## Properties

Name | Type
------------ | -------------
`tenantId` | string
`nombre` | string
`slug` | string
`createdAt` | Date
`updatedAt` | Date
`contabilidadTimezone` | string
`regimenFiscal` | string
`taxId` | string
`razonSocial` | string
`codigoPostalFiscal` | string
`fiscalActivado` | boolean
`totalUsers` | number
`totalProducts` | number
`totalWarehouses` | number
`totalClients` | number

## Example

```typescript
import type { AdminTenantDetail } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantId": null,
  "nombre": null,
  "slug": null,
  "createdAt": null,
  "updatedAt": null,
  "contabilidadTimezone": null,
  "regimenFiscal": null,
  "taxId": null,
  "razonSocial": null,
  "codigoPostalFiscal": null,
  "fiscalActivado": null,
  "totalUsers": null,
  "totalProducts": null,
  "totalWarehouses": null,
  "totalClients": null,
} satisfies AdminTenantDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminTenantDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


