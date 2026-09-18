
# TenantSummary


## Properties

Name | Type
------------ | -------------
`tenantId` | string
`nombre` | string
`tenantRole` | string

## Example

```typescript
import type { TenantSummary } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tenantId": null,
  "nombre": null,
  "tenantRole": null,
} satisfies TenantSummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TenantSummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


