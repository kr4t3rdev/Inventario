
# AdminLicenseItem


## Properties

Name | Type
------------ | -------------
`tenantLicenseId` | string
`tenantId` | string
`planId` | string
`activa` | boolean
`inicio` | Date
`expiracion` | Date
`maxUsuarios` | number
`maxAlmacenes` | number
`maxProductos` | number
`maxClientes` | number
`isDemo` | boolean
`isAdminTest` | boolean
`createdAt` | Date
`createdBy` | string
`createdByUser` | [AdminLicenseItemCreatedByUser](AdminLicenseItemCreatedByUser.md)
`plan` | [AdminTenantLicenseItemPlan](AdminTenantLicenseItemPlan.md)
`tenant` | [AdminLicenseItemTenant](AdminLicenseItemTenant.md)

## Example

```typescript
import type { AdminLicenseItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantLicenseId": null,
  "tenantId": null,
  "planId": null,
  "activa": null,
  "inicio": null,
  "expiracion": null,
  "maxUsuarios": null,
  "maxAlmacenes": null,
  "maxProductos": null,
  "maxClientes": null,
  "isDemo": null,
  "isAdminTest": null,
  "createdAt": null,
  "createdBy": null,
  "createdByUser": null,
  "plan": null,
  "tenant": null,
} satisfies AdminLicenseItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminLicenseItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


