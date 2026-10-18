
# GetAdminTenantDetailResponse


## Properties

Name | Type
------------ | -------------
`tenant` | [AdminTenantDetail](AdminTenantDetail.md)
`currentLicense` | [AdminLicenseSummary](AdminLicenseSummary.md)

## Example

```typescript
import type { GetAdminTenantDetailResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenant": null,
  "currentLicense": null,
} satisfies GetAdminTenantDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAdminTenantDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


