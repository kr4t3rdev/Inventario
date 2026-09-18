
# SwitchTenantResponse


## Properties

Name | Type
------------ | -------------
`accessToken` | [Token](Token.md)
`refreshToken` | [Token](Token.md)
`tenantId` | string
`tenantRole` | string

## Example

```typescript
import type { SwitchTenantResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "accessToken": null,
  "refreshToken": null,
  "tenantId": null,
  "tenantRole": null,
} satisfies SwitchTenantResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SwitchTenantResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


