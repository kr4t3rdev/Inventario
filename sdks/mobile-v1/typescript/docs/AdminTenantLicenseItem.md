
# AdminTenantLicenseItem


## Properties

Name | Type
------------ | -------------
`tenantLicenseId` | string
`tenantId` | string
`planId` | string
`activa` | boolean
`inicio` | Date
`expiracion` | Date
`isDemo` | boolean
`isAdminTest` | boolean
`createdAt` | Date
`plan` | [AdminTenantLicenseItemPlan](AdminTenantLicenseItemPlan.md)

## Example

```typescript
import type { AdminTenantLicenseItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantLicenseId": null,
  "tenantId": null,
  "planId": null,
  "activa": null,
  "inicio": null,
  "expiracion": null,
  "isDemo": null,
  "isAdminTest": null,
  "createdAt": null,
  "plan": null,
} satisfies AdminTenantLicenseItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminTenantLicenseItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


