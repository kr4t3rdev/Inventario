
# UpdateAdminTenantLicenseRequest


## Properties

Name | Type
------------ | -------------
`tenantLicenseId` | string
`planId` | string
`expiracion` | Date
`activa` | boolean
`isAdminTest` | boolean
`maxUsuarios` | number
`maxAlmacenes` | number
`maxProductos` | number
`maxClientes` | number

## Example

```typescript
import type { UpdateAdminTenantLicenseRequest } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantLicenseId": null,
  "planId": null,
  "expiracion": null,
  "activa": null,
  "isAdminTest": null,
  "maxUsuarios": null,
  "maxAlmacenes": null,
  "maxProductos": null,
  "maxClientes": null,
} satisfies UpdateAdminTenantLicenseRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateAdminTenantLicenseRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


