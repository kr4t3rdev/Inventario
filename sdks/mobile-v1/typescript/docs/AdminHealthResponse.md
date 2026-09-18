
# AdminHealthResponse


## Properties

Name | Type
------------ | -------------
`users` | [AdminHealthResponseUsers](AdminHealthResponseUsers.md)
`tenants` | [AdminHealthResponseTenants](AdminHealthResponseTenants.md)
`sessions` | [AdminHealthResponseSessions](AdminHealthResponseSessions.md)
`licenses` | [AdminHealthResponseLicenses](AdminHealthResponseLicenses.md)
`usersTrend` | [Array&lt;AdminHealthResponseUsersTrendInner&gt;](AdminHealthResponseUsersTrendInner.md)
`usersComparison` | [AdminHealthResponseUsersComparison](AdminHealthResponseUsersComparison.md)

## Example

```typescript
import type { AdminHealthResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "users": null,
  "tenants": null,
  "sessions": null,
  "licenses": null,
  "usersTrend": null,
  "usersComparison": null,
} satisfies AdminHealthResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AdminHealthResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


