
# PostAdminLicensesRenewResponse


## Properties

Name | Type
------------ | -------------
`tenantLicenseId` | string
`newExpiracion` | Date
`newPlanId` | string
`previousExpiracion` | Date
`previousPlanId` | string
`message` | string

## Example

```typescript
import type { PostAdminLicensesRenewResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantLicenseId": null,
  "newExpiracion": null,
  "newPlanId": null,
  "previousExpiracion": null,
  "previousPlanId": null,
  "message": null,
} satisfies PostAdminLicensesRenewResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostAdminLicensesRenewResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


