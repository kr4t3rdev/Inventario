
# AdminTenantItem


## Properties

Name | Type
------------ | -------------
`tenantId` | string
`nombre` | string
`createdAt` | Date
`updatedAt` | Date
`totalUsers` | number
`plan` | string
`planId` | string
`licenseActive` | boolean
`count` | [AdminTenantItemCount](AdminTenantItemCount.md)
`licencias` | [Array&lt;AdminTenantLicenseItem&gt;](AdminTenantLicenseItem.md)

## Example

```typescript
import type { AdminTenantItem } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantId": null,
  "nombre": null,
  "createdAt": null,
  "updatedAt": null,
  "totalUsers": null,
  "plan": null,
  "planId": null,
  "licenseActive": null,
  "count": null,
  "licencias": null,
} satisfies AdminTenantItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminTenantItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


